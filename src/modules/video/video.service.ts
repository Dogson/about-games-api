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
import { InjectModel } from '@nestjs/sequelize';
import { Video } from './entities/video.entity';
import { Game } from '../game/entities/game.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbService } from '../igdb/igdb.service';
import { GameService } from '../game/game.service';
import { ChannelService } from '../channel/channel.service';
import { YoutubeService } from '../youtube/youtube.service';

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

    const parsingAttribute = channel.get('parsingAttribute');

    const igdbGames = await this.igdbService.extractMentionedGames(
      (createVideoDto[parsingAttribute] as string) || createVideoDto.title,
      channel.get('ignoreSearchIn'),
      channel.get('endParsingAfter'),
    );

    const games = igdbGames.map((igdbGame) =>
      this.gameService.mapIgdbGamesToCreateGamesDTO(igdbGame),
    );

    const video = await this.videoModel.create({ ...createVideoDto });
    const gamesFoundOrCreated = await this.gameService.findOrCreateGames(games);
    await video.$set(
      'games',
      gamesFoundOrCreated.map((game) => game.id),
    );

    return video;
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
      this.logger.error(
        `Failed to remove deleted videos for channel "${channel.get('name')}": ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (destroyedVideos.length > 0) {
      this.logger.log(
        `Removed ${destroyedVideos.length} deleted videos from channel ${channel.get('name')} : ${destroyedVideos.join(', ')} .`,
      );
    }
    if (updatedVideos.length > 0) {
      this.logger.log(
        `Updated ${updatedVideos.length} videos for channel ${channel.get('name')} : ${updatedVideos.join(', ')} .`,
      );
    }
  }

  async findAll(): Promise<Video[]> {
    return await this.videoModel.findAll({
      include: [
        {
          model: Game,
          through: { attributes: [] },
        },
        {
          model: Channel,
        },
      ],
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
      validated: true,
      gamesFoundCount,
      gamesCount: games?.length || 0,
    });

    if (games) {
      const gamesFoundOrCreated =
        await this.gameService.findOrCreateGames(games);
      await existingVideo.$set(
        'games',
        gamesFoundOrCreated.map((game) => game.id),
      );
    }

    return await this.findOne(id); // return with relations
  }

  async remove(id: number): Promise<void> {
    const deletedRows = await this.videoModel.destroy({ where: { id } });

    if (deletedRows === 0) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }
  }
}
