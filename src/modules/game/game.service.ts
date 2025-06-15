import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Game } from './entities/game.entity';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from '../video/entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import type { FindAllGamesDto } from './dto/find-all-games.dto';
import { Sequelize } from 'sequelize';
import ApiConfig from '../../api.config';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(Game)
    private gameModel: typeof Game,
  ) {}

  async create(createGameDto: CreateGameDto): Promise<Game> {
    return await this.gameModel.create({ ...createGameDto });
  }

  async findAll(findAllGamesDto: FindAllGamesDto) {
    const page = findAllGamesDto.page ?? 1;
    const limit = findAllGamesDto.limit ?? ApiConfig.GAMES_LIMIT_DEFAULT;
    const offset = (page - 1) * limit;
    const { search } = findAllGamesDto;

    const relevanceSearch = search
      ? Sequelize.literal(
          `MATCH(Game.title) AGAINST(${this.escapeSearch(search)} IN NATURAL LANGUAGE MODE)`,
        )
      : undefined;

    const attributes = {
      include: [
        [
          Sequelize.literal(`(
        SELECT COUNT(*)
        FROM videos_has_games AS vhg
        WHERE vhg.game_id = Game.id
      )`),
          'videosCount',
        ],
        ...(relevanceSearch ? [[relevanceSearch, 'relevance']] : []),
      ] as [string | ReturnType<typeof Sequelize.literal>, string][], // ✅ Type assertion avoids extra type definition
    };

    const result = await this.gameModel.findAndCountAll({
      attributes,
      where: relevanceSearch,
      order: relevanceSearch
        ? [[Sequelize.col('relevance'), 'DESC']]
        : [['updated_at', 'DESC']],
      offset,
      limit,
      distinct: true,
    });

    return {
      data: result.rows,
      total: result.count,
      page,
      limit,
      totalPages: Math.ceil(result.count / limit),
    };
  }

  private escapeSearch(input: string): string {
    return `'${input.replace(/'/g, "\\'")}'`;
  }

  async findOne(id: number): Promise<Game> {
    const game = await this.gameModel.findByPk(id, {
      include: [
        {
          model: Video,
          through: { attributes: [] },
          include: [{ model: Channel }],
        },
      ],
    });
    if (!game) {
      throw new NotFoundException(`Game with id ${id} not found`);
    }
    return game;
  }

  async update(id: number, updateGameDto: UpdateGameDto): Promise<Game> {
    const existingGame = await this.gameModel.findByPk(id);

    if (!existingGame) {
      throw new NotFoundException(`Game with id ${id} not found`);
    }

    await this.gameModel.update(updateGameDto, {
      where: { id },
    });

    const updatedGame = await this.gameModel.findByPk(id);
    return updatedGame!;
  }

  async remove(id: number): Promise<void> {
    const deletedRows = await this.gameModel.destroy({ where: { id } });
    if (deletedRows === 0) {
      throw new NotFoundException(`Game with id ${id} not found`);
    }
  }
}
