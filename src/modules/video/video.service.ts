import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { FindAllVideosDto } from './dto/find-all-videos.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from './entities/video.entity';
import { WhereOptions } from 'sequelize';
import { Game } from '../game/entities/game.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbService } from '../igdb/igdb.service';
import { GameService } from '../game/game.service';
import { ChannelService } from '../channel/channel.service';
import { YoutubeService } from '../youtube/youtube.service';
import { AppLogger } from '../logging/app-logger.service';
import { VideosHasGames } from '../../db/many-to-many/videos-has-games.table';
import { DeepseekService } from '../ai/deepseek.service';
import { DEFAULT_GAME_CANDIDATE_AI_PROMPT } from '../ai/game-candidate.prompt';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video)
    private videoModel: typeof Video,
    private readonly igdbService: IgdbService,
    private readonly gameService: GameService,
    private readonly youtubeService: YoutubeService,
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
    private readonly deepseekService: DeepseekService,
    private readonly appLogger: AppLogger,
  ) {}

  private readonly logger = new Logger(VideoService.name);

  async create(createVideoDto: CreateVideoDto): Promise<Video> {
    const channel = await this.channelService.findOne(
      createVideoDto.ytChannelId,
    );
    if (!channel) {
      throw new NotFoundException(
        `Channel with id ${createVideoDto.ytChannelId} not found`,
      );
    }

    // check if video with the same YouTube ID already exists before
    const existingVideo = await this.videoModel.findOne({
      where: { youtubeId: createVideoDto.youtubeId },
    });
    if (existingVideo) {
      throw new BadRequestException(
        `Video with YouTube ID ${createVideoDto.youtubeId} already exists`,
      );
    }

    const video = await this.videoModel.create({
      ...createVideoDto,
      hasSearchedGames: false,
    });

    try {
      await this._searchAndLinkGames(
        video,
        channel,
        createVideoDto.title,
        createVideoDto.description,
      );
    } catch (error) {
      this.appLogger.error(
        `Failed to extract games for video "${createVideoDto.title}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return video;
  }

  private async _searchAndLinkGames(
    video: Video,
    channel: Channel,
    title: string,
    description: string,
  ): Promise<void> {
    const prompt =
      channel.get('gameCandidateAIPrompt') || DEFAULT_GAME_CANDIDATE_AI_PROMPT;

    const gameNames = await this.deepseekService.extractMainGameNames(
      prompt,
      title,
      description,
    );

    const igdbGames = await this.igdbService.findGamesByNames(gameNames);

    const games = igdbGames.map((igdbGame) =>
      this.gameService.mapIgdbGamesToCreateGamesDTO(igdbGame),
    );

    const gamesFoundOrCreated = await this.gameService.findOrCreateGames(games);

    await VideosHasGames.destroy({ where: { videoId: video.id } });

    const videosHasGamesRecords = gamesFoundOrCreated.map(
      (game, index): { videoId: number; gameId: number; rank: number } => ({
        videoId: video.id as number,
        gameId: game.id,
        rank: index,
      }),
    );
    await VideosHasGames.bulkCreate(videosHasGamesRecords);

    await video.update({
      hasSearchedGames: true,
      gamesCount: gamesFoundOrCreated.length,
      gamesFoundCount: gamesFoundOrCreated.length,
    });
  }

  async syncVideosFromYoutube(channel: Channel) {
    const destroyedVideos: string[] = [];
    const updatedVideos: string[] = [];
    try {
      const youtubeUploadsId = channel.get('youtubeUploadsId');

      const ytVideos =
        await this.youtubeService.getAllVideosFromChannel(youtubeUploadsId);
      const ytVideoIds = new Set(ytVideos.map((v) => v.videoId));
      const existingVideos: Video[] = channel.get('videos') || [];
      for (const video of existingVideos) {
        const videoId = video.get('youtubeId');
        if (!ytVideoIds.has(videoId)) {
          destroyedVideos.push(video.get('title'));
          await video.destroy(); // or this.videoModel.destroy({ where: { id: video.id } });
        } else {
          const videoThumbnail = video.get('thumbnailUrl');
          const videoTitle = video.get('title');
          const videoDescription = video.get('description');
          const youtubeVideo = ytVideos.find((v) => v.videoId === videoId);
          if (
            youtubeVideo &&
            (videoThumbnail !== youtubeVideo.thumbnailUrl ||
              videoTitle !== youtubeVideo.title ||
              videoDescription !== youtubeVideo.description)
          ) {
            await video.update({
              thumbnailUrl: youtubeVideo.thumbnailUrl,
              title: youtubeVideo.title,
              description: youtubeVideo.description,
            });
            updatedVideos.push(video.get('title'));
          }
        }
      }
    } catch (e) {
      this.appLogger.error(
        `Failed to remove deleted videos for channel "${channel.get('name')}": ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (destroyedVideos.length > 0) {
      this.appLogger.log(
        `Removed ${destroyedVideos.length} deleted videos from channel ${channel.get('name')} : ${destroyedVideos.join(', ')} .`,
      );
    }
    if (updatedVideos.length > 0) {
      this.appLogger.log(
        `Updated ${updatedVideos.length} videos for channel ${channel.get('name')} : ${updatedVideos.join(', ')} .`,
      );
    }
  }

  async purgeShortsFromChannel(channel: Channel): Promise<void> {
    const videos: Video[] = channel.get('videos') || [];
    const shortsToRemove: string[] = [];
    const concurrency = 5;
    let index = 0;

    const worker = async (): Promise<void> => {
      while (index < videos.length) {
        const video = videos[index];
        index++;
        try {
          if (
            await this.youtubeService.isYoutubeShort(video.get('youtubeId'))
          ) {
            shortsToRemove.push(video.get('title'));
            await video.destroy();
          }
        } catch (error) {
          this.appLogger.error(
            `Failed to check video "${video.get('title')}" for channel "${channel.get('name')}": ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, videos.length) }, worker),
    );

    if (shortsToRemove.length > 0) {
      this.appLogger.log(
        `Removed ${shortsToRemove.length} Shorts videos from channel ${channel.get('name')} : ${shortsToRemove.join(', ')} .`,
      );
    }
  }

  async findAll(findAllVideosDto?: FindAllVideosDto): Promise<Video[]> {
    const where: WhereOptions<Video> = {};

    if (findAllVideosDto?.validated !== undefined) {
      where.validated = findAllVideosDto.validated;
    }

    if (findAllVideosDto?.hasSearchedGames !== undefined) {
      where.hasSearchedGames = findAllVideosDto.hasSearchedGames;
    }

    return await this.videoModel.findAll({
      where,
      include: [
        {
          model: Game,
          through: { attributes: [] },
        },
        {
          model: Channel,
        },
      ],
      order: [[{ model: Game, as: 'games' }, VideosHasGames, 'rank', 'ASC']],
    });
  }

  async findOne(id: number): Promise<Video> {
    const video = await this.videoModel.findByPk(id, {
      include: [
        {
          model: Game,
          through: { attributes: [] },
        },
        {
          model: Channel,
        },
      ],
      order: [[{ model: Game, as: 'games' }, VideosHasGames, 'rank', 'ASC']],
    });

    if (!video) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }

    return video;
  }

  async update(id: number, updateVideoDto: UpdateVideoDto): Promise<Video> {
    const existingVideo = await this.videoModel.findByPk(id, {
      include: [
        {
          model: Game,
          through: { attributes: [] },
        },
      ],
    });

    if (!existingVideo) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }

    const { games, ...videoData } = updateVideoDto;

    const existingGames = existingVideo.get('games');
    let gamesFoundCount = existingVideo.get('gamesFoundCount');
    const validated = existingVideo.get('validated');

    if (!validated) {
      if (!games || !existingGames) {
        gamesFoundCount = 0;
      } else {
        gamesFoundCount = existingGames.filter((existingGame) =>
          games.map((game) => game.igdbId).includes(existingGame.get('igdbId')),
        ).length;
      }
    }

    await existingVideo.update({
      ...videoData,
      gamesFoundCount,
      gamesCount: games?.length || 0,
    });

    if (games) {
      const gamesFoundOrCreated =
        await this.gameService.findOrCreateGames(games);
      await VideosHasGames.destroy({ where: { videoId: id } });
      const videosHasGamesRecords = gamesFoundOrCreated.map(
        (game, index): { videoId: number; gameId: number; rank: number } => ({
          videoId: id,
          gameId: game.id,
          rank: index,
        }),
      );
      await VideosHasGames.bulkCreate(videosHasGamesRecords);
    }

    return await this.findOne(id); // return with relations
  }

  async remove(id: number): Promise<void> {
    const deletedRows = await this.videoModel.destroy({ where: { id } });

    if (deletedRows === 0) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }
  }

  async regenerateGamesForVideo(video: Video): Promise<void> {
    const channel = await this.channelService.findOne(video.ytChannelId);

    await this._searchAndLinkGames(
      video,
      channel,
      video.title,
      video.description,
    );
  }
}
