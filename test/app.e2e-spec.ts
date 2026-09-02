import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { GameController } from '../src/modules/game/game.controller';
import { GameService } from '../src/modules/game/game.service';
import { VideoController } from '../src/modules/video/video.controller';
import { VideoService } from '../src/modules/video/video.service';
import { ChannelController } from '../src/modules/channel/channel.controller';
import { ChannelService } from '../src/modules/channel/channel.service';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { UserController } from '../src/modules/user/user.controller';
import { UserService } from '../src/modules/user/user.service';
import { LogsController } from '../src/modules/logging/logging.controller';
import { LogBusService } from '../src/modules/logging/log-bus.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { JwtAuthGuard } from '../src/modules/auth/jwt-auth.guard';
import { SseJwtGuard } from '../src/modules/auth/sse-jwt.guard';
import { SequelizeExceptionFilter } from '../src/filters/sequelize-exception.filter';
import { UniqueConstraintError } from 'sequelize';

const JWT_SECRET = 'test-secret';

describe('API (e2e, DB-free)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const gameService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    igdbSearch: jest.fn(),
    igdbSearchWithinText: jest.fn(),
    syncAllGamesWithIgdb: jest.fn(),
  };
  const videoService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };
  const channelService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOneForApi: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    generateMissingVideosForAllChannels: jest.fn(),
    generateGamesForChannel: jest.fn(),
    syncAllYoutubeChannels: jest.fn(),
  };
  const authService = {
    validateUser: jest.fn(),
    sign: jest.fn(),
  };
  const userService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeAll(async () => {
    const configService = {
      get: (key: string): unknown =>
        key === 'SECRET_JWT_KEY' ? JWT_SECRET : undefined,
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: JWT_SECRET })],
      controllers: [
        AppController,
        GameController,
        VideoController,
        ChannelController,
        AuthController,
        UserController,
        LogsController,
      ],
      providers: [
        AppService,
        LogBusService,
        JwtStrategy,
        JwtAuthGuard,
        SseJwtGuard,
        { provide: ConfigService, useValue: configService },
        { provide: GameService, useValue: gameService },
        { provide: VideoService, useValue: videoService },
        { provide: ChannelService, useValue: channelService },
        { provide: AuthService, useValue: authService },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new SequelizeExceptionFilter());
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    gameService.findAll.mockResolvedValue({
      data: [{ id: 1, title: 'Game' }],
      total: 1,
      page: 1,
      limit: 30,
      totalPages: 1,
    });
    gameService.findOne.mockResolvedValue({ id: 1, title: 'Game' });
    videoService.findAll.mockResolvedValue([]);
    videoService.findOne.mockResolvedValue({ id: 1, title: 'Video' });
    channelService.findAll.mockResolvedValue([]);
    channelService.findOneForApi.mockResolvedValue({
      id: 1,
      name: 'Channel',
      youtubeHandle: 'handle',
      youtubeId: 'UC',
      youtubeUploadsId: 'UU',
      language: 'en',
      parsingOptions: {},
    });
  });

  const authed = (token: string): Record<string, string> => ({
    Authorization: `Bearer ${token}`,
  });

  const validToken = (): string =>
    jwtService.sign({ sub: 1, username: 'alice' });

  describe('root', () => {
    it('GET / returns hello world', () => {
      return request(app.getHttpServer())
        .get('/')
        .expect(200)
        .expect('Hello World!');
    });
  });

  describe('public read routes', () => {
    it('GET /games returns the paginated payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/games')
        .expect(200);

      expect(response.body).toEqual({
        data: [{ id: 1, title: 'Game' }],
        total: 1,
        page: 1,
        limit: 30,
        totalPages: 1,
      });
      expect(gameService.findAll).toHaveBeenCalledWith({});
    });

    it('GET /games/:id maps params and optional query filters', async () => {
      await request(app.getHttpServer())
        .get('/games/42?onlyValidatedVideos=false&languages=fr,en')
        .expect(200);

      expect(gameService.findOne).toHaveBeenCalledWith(42, false, ['fr', 'en']);
    });

    it('GET /games/:id returns 404 when the service throws NotFoundException', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      gameService.findOne.mockRejectedValue(
        new NotFoundException('Game with id 99 not found'),
      );

      await request(app.getHttpServer()).get('/games/99').expect(404);
    });

    it('GET /videos and GET /channels respond', async () => {
      await request(app.getHttpServer()).get('/videos').expect(200);
      await request(app.getHttpServer()).get('/channels').expect(200);
      await request(app.getHttpServer()).get('/channels/1').expect(200);
    });
  });

  describe('authentication', () => {
    it('guards write routes behind a valid JWT', async () => {
      const gameServiceTyped = gameService as {
        create: jest.Mock;
      };
      gameServiceTyped.create.mockResolvedValue({ id: 1 });

      await request(app.getHttpServer())
        .post('/games')
        .send({
          igdbId: 1,
          title: 'Game',
          releaseDate: '2020-01-01',
          companies: ['A'],
        })
        .expect(401);

      const token = validToken();
      const response = await request(app.getHttpServer())
        .post('/games')
        .set(authed(token))
        .send({
          igdbId: 1,
          title: 'Game',
          releaseDate: '2020-01-01',
          companies: ['A'],
        })
        .expect(201);

      expect(response.body).toEqual({ id: 1 });
    });

    it('POST /auth/login returns a token for valid credentials', async () => {
      authService.validateUser.mockResolvedValue({
        id: 1,
        username: 'alice',
        admin: true,
      });
      authService.sign.mockReturnValue('signed-token');

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'alice', password: 'secret1' })
        .expect(201);

      expect(response.body.access_token).toBe('signed-token');
      expect(response.body.user.username).toBe('alice');
      expect(authService.sign).toHaveBeenCalledWith({
        sub: 1,
        username: 'alice',
      });
    });

    it('POST /auth/login rejects unknown credentials', async () => {
      authService.validateUser.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'alice', password: 'secret1' })
        .expect(401);
    });

    it('GET /auth/validate echoes the authenticated user', async () => {
      await request(app.getHttpServer()).get('/auth/validate').expect(401);

      const response = await request(app.getHttpServer())
        .get('/auth/validate')
        .set(authed(validToken()))
        .expect(200);

      expect(response.body).toEqual({ userId: 1, username: 'alice' });
    });
  });

  describe('validation', () => {
    it('rejects an invalid channel creation body', async () => {
      await request(app.getHttpServer())
        .post('/channels')
        .set(authed(validToken()))
        .send({ youtubeHandle: '' })
        .expect(400);
    });

    it('rejects an invalid login body (short password)', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'alice', password: '123' })
        .expect(400);
    });

    it('rejects an invalid video body on PATCH', async () => {
      await request(app.getHttpServer())
        .patch('/videos/1')
        .set(authed(validToken()))
        .send({ ytChannelId: 'not-a-number' })
        .expect(400);
    });
  });

  describe('error mapping', () => {
    it('maps a unique-constraint error to a 409', async () => {
      const exception = Object.create(
        UniqueConstraintError.prototype,
      ) as UniqueConstraintError;
      Object.assign(exception, {
        errors: [{ message: 'youtube_handle must be unique' }],
      });
      gameService.create.mockRejectedValue(exception);

      await request(app.getHttpServer())
        .post('/games')
        .set(authed(validToken()))
        .send({
          igdbId: 1,
          title: 'Game',
          releaseDate: '2020-01-01',
          companies: ['A'],
        })
        .expect(409)
        .expect((response) => {
          expect(response.body.details).toEqual([
            'youtube_handle must be unique',
          ]);
        });
    });

    it('exposes a 204 on channel deletion', async () => {
      channelService.remove.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/channels/1')
        .set(authed(validToken()))
        .expect(204);
    });
  });

  describe('logs endpoints', () => {
    it('GET /logs/last requires authentication and returns buffered logs', async () => {
      const logBus = app.get(LogBusService);
      logBus.emit({
        message: 'boot',
        level: 'log',
        context: 'app',
        timestamp: 1,
      });

      await request(app.getHttpServer()).get('/logs/last').expect(401);

      const response = await request(app.getHttpServer())
        .get('/logs/last')
        .set(authed(validToken()))
        .expect(200);

      expect(response.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ message: 'boot', level: 'log' }),
        ]),
      );
    });
  });
});
