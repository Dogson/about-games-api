import { Injectable } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from './entities/video.entity';
import { Game } from '../game/entities/game.entity';
import { Channel } from '../channel/entities/channel.entity';

@Injectable()
export class VideoService {
  constructor(
    @InjectModel(Video)
    private videoModel: typeof Video,
  ) {}

  create(createVideoDto: CreateVideoDto) {
    console.log(createVideoDto);
    return 'This action adds a new video';
  }

  findAll() {
    return this.videoModel.findAll({
      include: [
        {
          model: Game,
          through: {
            attributes: [],
          },
        },
        {
          model: Channel,
        },
      ],
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} video`;
  }

  update(id: number, updateVideoDto: UpdateVideoDto) {
    console.log(updateVideoDto);
    return `This action updates a #${id} video`;
  }

  remove(id: number) {
    return `This action removes a #${id} video`;
  }
}
