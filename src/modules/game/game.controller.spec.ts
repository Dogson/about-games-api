import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('GameController', () => {
  let controller: GameController;
  let gameService: jest.Mocked<GameService>;

  beforeEach(async () => {
    gameService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      igdbSearch: jest.fn(),
      igdbSearchWithinText: jest.fn(),
      syncAllGamesWithIgdb: jest.fn(),
    } as unknown as jest.Mocked<GameService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
      providers: [{ provide: GameService, useValue: gameService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(GameController);
  });

  it('delegates findAll with the raw query', async () => {
    await controller.findAll({ search: 'zelda' });
    expect(gameService.findAll).toHaveBeenCalledWith({ search: 'zelda' });
  });

  it('parses the id and defaults onlyValidated to true on findOne', async () => {
    await controller.findOne('42', {});
    expect(gameService.findOne).toHaveBeenCalledWith(42, true, undefined);
  });

  it('forwards onlyValidatedVideos and languages on findOne', async () => {
    await controller.findOne('42', {
      onlyValidatedVideos: false,
      languages: ['fr', 'en'],
    });
    expect(gameService.findOne).toHaveBeenCalledWith(42, false, ['fr', 'en']);
  });

  it('delegates create, update and remove with a numeric id', async () => {
    const dto = {
      igdbId: 1,
      title: 'Game',
      releaseDate: new Date('2020-01-01'),
      companies: ['A'],
      coverImg: null,
      boxartImg: null,
    };
    await controller.create(dto);
    expect(gameService.create).toHaveBeenCalledWith(dto);

    await controller.update('7', { title: 'Renamed' });
    expect(gameService.update).toHaveBeenCalledWith(7, { title: 'Renamed' });

    await controller.remove('7');
    expect(gameService.remove).toHaveBeenCalledWith(7);
  });

  it('routes igdbSearch to the search service', async () => {
    await controller.igdbSearch('id:123');
    expect(gameService.igdbSearch).toHaveBeenCalledWith('id:123');
  });

  it('routes igdbSearchWithinText using the dto text', async () => {
    await controller.igdbSearchWithinText({ text: 'a video about zelda' });
    expect(gameService.igdbSearchWithinText).toHaveBeenCalledWith(
      'a video about zelda',
    );
  });

  it('kicks the full IGDB sync', async () => {
    await controller.syncAllGames();
    expect(gameService.syncAllGamesWithIgdb).toHaveBeenCalled();
  });
});
