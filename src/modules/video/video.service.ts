import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from './entities/video.entity';
import { Game } from '../game/entities/game.entity';
import { Channel } from '../channel/entities/channel.entity';
import { IgdbService } from '../igdb/igdb.service';
import { GameService } from '../game/game.service';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video)
    private videoModel: typeof Video,
    private readonly igdbService: IgdbService,
    private readonly gameService: GameService,
  ) {}

  async create(createVideoDto: CreateVideoDto): Promise<Video> {
    // todo rollback and put this else where, in a CRON or a trigger or smhg.
    const video = await this.videoModel.create({ ...createVideoDto });

    const games = await this.igdbService.extractMentionedGames(
      createVideoDto.description,
    );

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
    const existingVideo = await this.videoModel.findByPk(id);

    if (!existingVideo) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }

    await this.videoModel.update(updateVideoDto, {
      where: { id },
    });

    const updatedVideo = await this.videoModel.findByPk(id, {
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

    return updatedVideo!;
  }

  async remove(id: number): Promise<void> {
    const deletedRows = await this.videoModel.destroy({ where: { id } });

    if (deletedRows === 0) {
      throw new NotFoundException(`Video with id ${id} not found`);
    }
  }
}
