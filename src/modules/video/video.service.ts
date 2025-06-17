import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
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

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video)
    private videoModel: typeof Video,
    private readonly igdbService: IgdbService,
    private readonly gameService: GameService,
    @Inject(forwardRef(() => ChannelService))
    private readonly channelService: ChannelService,
  ) {}

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

    const igdbGames = await this.igdbService.extractMentionedGames(
      createVideoDto[channel.get('parsingAttribute')] || createVideoDto.title,
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
