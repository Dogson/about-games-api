import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Game } from './entities/game.entity';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from '../video/entities/video.entity';
import { Channel } from '../channel/entities/channel.entity';
import type { FindAllGamesDto } from './dto/find-all-games.dto';
import { Op, Sequelize, WhereOptions } from 'sequelize';
import ApiConfig from '../../api.config';
import type { IGDBGame } from '../igdb/dto/igdb-get-game.dto';

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
    const { search, ignoreDuringSearch, igdbId } = findAllGamesDto;

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
      ] as [string | ReturnType<typeof Sequelize.literal>, string][],
    };

    const andConditions: WhereOptions[] = [];

    if (relevanceSearch) {
      andConditions.push(Sequelize.where(relevanceSearch, { [Op.gt]: 0 }));
    }

    if (ignoreDuringSearch !== undefined) {
      andConditions.push({ ignoreDuringSearch: ignoreDuringSearch ? 1 : 0 });
    }

    if (igdbId) {
      andConditions.push({ igdbId });
    }

    // Compose the final where clause
    const where =
      andConditions.length > 0 ? { [Op.and]: andConditions } : undefined;

    const result = await this.gameModel.findAndCountAll({
      attributes,
      where,
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

  async findOrCreateGames(games: IGDBGame[]): Promise<Game[]> {
    const gamePromises = games.map(async (game) => {
      const firstReleaseDate = Math.min(
        ...(game.release_dates || []).map((date) => date.date),
      );

      const [foundGame, created] = await this.gameModel.findOrCreate({
        where: { igdbId: game.id },
        defaults: {
          title: game.name,
          igdbId: game.id,
          boxartImg: game.cover?.url
            ? `https:${game.cover.url.replace('t_thumb', 't_cover_big')}`
            : null,
          coverImg: game.screenshots?.[0]?.url
            ? `https:${game.screenshots?.[0]?.url.replace('t_thumb', 't_1080p')}`
            : null,
          releaseDate: firstReleaseDate
            ? new Date(firstReleaseDate * 1000)
            : null,
          companies: (game.involved_companies || []).map(
            (company) => company.company.name,
          ),
          ignoreDuringSearch: false,
        },
      });

      return foundGame || created;
    });

    return await Promise.all(gamePromises);
  }
}
