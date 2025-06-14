import { Injectable } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Game } from './entities/game.entity';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from '../video/entities/video.entity';
import { Company } from '../company/entities/company.entity';
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

  create(createGameDto: CreateGameDto) {
    console.log(createGameDto);
    return 'This action adds a new game';
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

    const result = await this.gameModel.findAndCountAll({
      attributes: {
        include: relevanceSearch ? [[relevanceSearch, 'relevance']] : [],
      },
      where: relevanceSearch,
      order: relevanceSearch
        ? [[Sequelize.col('relevance'), 'DESC']]
        : [['updated_on', 'DESC']],
      include: [
        {
          model: Video,
          through: { attributes: [] },
          include: [{ model: Channel }],
        },
        {
          model: Company,
          through: { attributes: [] },
        },
      ],
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

  findOne(id: number) {
    return `This action returns a #${id} game`;
  }

  update(id: number, updateGameDto: UpdateGameDto) {
    console.log(updateGameDto);
    return `This action updates a #${id} game`;
  }

  remove(id: number) {
    return `This action removes a #${id} game`;
  }
}
