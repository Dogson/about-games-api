import { Test, TestingModule } from '@nestjs/testing';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

describe('VideoController', () => {
  let controller: VideoController;
  let videoService: jest.Mocked<VideoService>;

  beforeEach(async () => {
    videoService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    } as unknown as jest.Mocked<VideoService>;

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [VideoController],
      providers: [{ provide: VideoService, useValue: videoService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(VideoController);
  });

  it('delegates findAll with the parsed query filters', async () => {
    await controller.findAll({ validated: true });
    expect(videoService.findAll).toHaveBeenCalledWith({ validated: true });
  });

  it('delegates findOne with a numeric id', async () => {
    await controller.findOne('9');
    expect(videoService.findOne).toHaveBeenCalledWith(9);
  });

  it('delegates create, update and remove', async () => {
    const dto = {
      ytChannelId: 1,
      title: 'Video',
      youtubeId: 'yt-1',
      description: 'desc',
      thumbnailUrl: 'https://t',
    };
    await controller.create(dto);
    expect(videoService.create).toHaveBeenCalledWith(dto);

    await controller.update('9', { title: 'Renamed' });
    expect(videoService.update).toHaveBeenCalledWith(9, { title: 'Renamed' });

    await controller.remove('9');
    expect(videoService.remove).toHaveBeenCalledWith(9);
  });
});
