import { Injectable } from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import { Game } from './entities/game.entity';
import { InjectModel } from '@nestjs/sequelize';
import { Video } from '../video/entities/video.entity';
import { Company } from '../company/entities/company.entity';
import { Channel } from '../channel/entities/channel.entity';

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

  findAll() {
    return this.gameModel.findAll({
      include: [
        {
          model: Video,
          through: {
            attributes: [],
          },
          include: [
            {
              model: Channel,
            },
          ],
        },
        {
          model: Company,
          through: {
            attributes: [],
          },
        },
      ],
    });
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
