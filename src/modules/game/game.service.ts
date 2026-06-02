import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { instanceToPlain } from 'class-transformer';
import { IgdbService } from '../igdb/igdb.service';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class GameService {
  constructor(
    @InjectModel(Game)
    private gameModel: typeof Game,
    @Inject(forwardRef(() => IgdbService))
    private readonly igdbService: IgdbService,
    private readonly appLogger: AppLogger,
  ) {}

  async create(createGameDto: CreateGameDto): Promise<Game> {
    return await this.gameModel.create({ ...createGameDto });
  }

  async findAll(findAllGamesDto: FindAllGamesDto) {
    const page = findAllGamesDto.page ?? 1;
    const limit = findAllGamesDto.limit ?? ApiConfig.GAMES_LIMIT_DEFAULT;
    const offset = (page - 1) * limit;
    const { search, ignoreDuringSearch, igdbId, onlyValidated, withVideos } =
      findAllGamesDto;
    const { languages } = findAllGamesDto;

    const includeVideos = withVideos
      ? [
          {
            model: Video,
            through: { attributes: [] },
            required: false,
            include: [
              {
                model: Channel,
              },
            ],
          },
        ]
      : undefined;

    const searchConditions: WhereOptions[] = [];

    const relevanceSearch = search
      ? Sequelize.literal(
          `MATCH(Game.title) AGAINST(${this.escapeSearch(search)} IN NATURAL LANGUAGE MODE)`,
        )
      : undefined;

    if (relevanceSearch) {
      searchConditions.push(Sequelize.where(relevanceSearch, { [Op.gt]: 0 }));
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchConditions.push({
        title: { [Op.regexp]: `(?i)\\b${escapedSearch}` },
      });
    }

    const combinedSearchCondition =
      searchConditions.length > 0 ? { [Op.or]: searchConditions } : undefined;

    const filterConditions: WhereOptions[] = [];

    if (ignoreDuringSearch !== undefined) {
      filterConditions.push({ ignoreDuringSearch: ignoreDuringSearch ? 1 : 0 });
    }

    if (igdbId) {
      filterConditions.push({ igdbId });
    }

    if (languages && languages.length > 0) {
      const languageValues = languages
        .map((language) => language.trim().toLowerCase())
        .filter(Boolean)
        .map((language) => this.escapeSqlString(language))
        .join(', ');

      if (languageValues.length > 0) {
        filterConditions.push(
          Sequelize.literal(`EXISTS (
          SELECT 1
          FROM videos_has_games AS vhg
          INNER JOIN videos AS v ON v.id = vhg.video_id
          INNER JOIN yt_channel AS c ON c.id = v.yt_channel_id
          WHERE vhg.game_id = Game.id
            AND LOWER(c.language) IN (${languageValues})
        )`),
        );
      }
    }

    // ✅ Apply verified filter only if requested
    if (onlyValidated) {
      filterConditions.push(
        Sequelize.literal(`EXISTS (
        SELECT 1
        FROM videos_has_games AS vhg
        INNER JOIN videos AS v ON v.id = vhg.video_id
        WHERE vhg.game_id = Game.id
          AND v.validated = 1
      )`),
      );
    }

    const where: WhereOptions = combinedSearchCondition
      ? { [Op.and]: [combinedSearchCondition, ...filterConditions] }
      : { [Op.and]: filterConditions };

    const attributes = {
      include: [
        [
          Sequelize.literal(`(
          SELECT COUNT(*)
          FROM videos_has_games AS vhg
          INNER JOIN videos AS v ON v.id = vhg.video_id
          WHERE vhg.game_id = Game.id
            ${onlyValidated ? 'AND v.validated = 1' : ''}
        )`),
          'videosCount',
        ],
        ...(relevanceSearch ? [[relevanceSearch, 'relevance']] : []),
      ] as [string | ReturnType<typeof Sequelize.literal>, string][],
    };

    const result = await this.gameModel.findAndCountAll({
      attributes,
      where,
      include: includeVideos,
      order: relevanceSearch
        ? [
            [Sequelize.col('relevance'), 'DESC'],
            ['updated_at', 'DESC'],
            ['id', 'ASC'],
          ]
        : [
            ['updated_at', 'DESC'],
            ['id', 'ASC'],
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

  private escapeSqlString(input: string): string {
    return `'${input.replace(/'/g, "''")}'`;
  }

  async findOne(
    id: number,
    onlyValidatedVideos: boolean = true,
    languages?: string[],
  ): Promise<Game> {
    const videoWhere: WhereOptions = {};
    if (onlyValidatedVideos) {
      videoWhere['validated'] = true;
    }

    const normalizedLanguages = languages
      ?.map((lang) => lang.trim().toLowerCase())
      .filter(Boolean);
    const channelWhere = normalizedLanguages?.length
      ? { language: { [Op.in]: normalizedLanguages } }
      : undefined;

    const videoIncludeConfig: any = {
      model: Video,
      through: { attributes: [] },
      required: false,
      ...(Object.keys(videoWhere).length && { where: videoWhere }),
      include: [
        {
          model: Channel,
          ...(channelWhere && { where: channelWhere, required: true }),
        },
      ],
    };

    const game = await this.gameModel.findByPk(id, {
      include: [videoIncludeConfig],
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

  async findOrCreateGames(games: CreateGameDto[]): Promise<Game[]> {
    const gamePromises = games.map(async (gameDto) => {
      const plainGame = instanceToPlain(gameDto);
      const [foundGame, created] = await this.gameModel.findOrCreate({
        where: { igdbId: plainGame.igdbId },
        defaults: {
          ...plainGame,
        },
      });

      return foundGame || created;
    });

    return await Promise.all(gamePromises);
  }

  mapIgdbGamesToCreateGamesDTO(igdbGame: IGDBGame): CreateGameDto {
    const firstReleaseDate =
      igdbGame.release_dates && igdbGame.release_dates.length > 0
        ? Math.min(...(igdbGame.release_dates || []).map((date) => date.date))
        : undefined;

    return {
      title: igdbGame.name,
      igdbId: igdbGame.id,
      boxartImg: igdbGame.cover?.url
        ? `https:${igdbGame.cover.url.replace('t_thumb', 't_cover_big')}`
        : null,
      coverImg: igdbGame.screenshots?.[0]?.url
        ? `https:${igdbGame.screenshots?.[0]?.url.replace('t_thumb', 't_1080p')}`
        : null,
      releaseDate: firstReleaseDate ? new Date(firstReleaseDate * 1000) : null,
      companies: (igdbGame.involved_companies || []).map(
        (company) => company.company.name,
      ),
      ignoreDuringSearch: false,
    };
  }

  async syncAllGamesWithIgdb() {
    const games = await this.gameModel.findAll();

    for (const game of games) {
      const igdbGame = await this.igdbService.getIGDBGameById(
        game.get('igdbId'),
      );

      if (!igdbGame) {
        console.warn(
          `No IGDB data found for game with ID ${game.get('title')}`,
        );
      } else {
        const updateDTOFromIgdb = this.mapIgdbGamesToCreateGamesDTO(igdbGame);
        const gameData = game.get({ plain: true }) as UpdateGameDto;

        const keysToUpdate = Object.keys(updateDTOFromIgdb).filter((key) => {
          if (!updateDTOFromIgdb[key] && !gameData[key]) {
            return false;
          }
          if (Array.isArray(updateDTOFromIgdb[key])) {
            return (
              JSON.stringify(updateDTOFromIgdb[key]) !==
              JSON.stringify(gameData[key])
            );
          }
          if (key === 'releaseDate') {
            return (
              new Date(updateDTOFromIgdb[key] as Date).getTime() !==
              new Date(gameData[key] as Date).getTime()
            );
          }
          return updateDTOFromIgdb[key] !== gameData[key];
        });

        if (keysToUpdate.length > 0) {
          await this.update(game.get('id'), updateDTOFromIgdb);
          this.appLogger.log(
            `Updated game ${game.get('title')} with new IGDB data : ${keysToUpdate.map((key) => `${key}=${updateDTOFromIgdb[key]}`).join(', ')}.`,
          );
        }
      }
    }
  }

  async igdbSearch(search: string): Promise<IGDBGame[]> {
    return this.igdbService.queryIGDBByName(search);
  }

  async igdbSearchWithinText(text: string): Promise<IGDBGame[]> {
    return this.igdbService.extractMentionedGames(text);
  }
}
