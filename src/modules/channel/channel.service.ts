import { Injectable } from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Channel } from './entities/channel.entity';
import { Video } from '../video/entities/video.entity';

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(Channel)
    private channelModel: typeof Channel,
  ) {}

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    console.log(createChannelDto);

    // Conversion manuelle des tableaux en JSON string pour Sequelize (base MySQL)
    const channelData = {
      ...createChannelDto,
      ignoreEpisodesContaining: JSON.stringify(
        createChannelDto.ignoreEpisodesContaining,
      ),
      ignoreSearchIn: JSON.stringify(createChannelDto.ignoreSearchIn),
      endParsingAfter: JSON.stringify(createChannelDto.endParsingAfter),
    };

    return await this.channelModel.create(channelData);
  }

  findAll() {
    return this.channelModel.findAll({
      include: [{ model: Video }],
    });
  }

  findOne(id: number) {
    return `This action returns a #${id} channel`;
  }

  async update(id: number, updateChannelDto: UpdateChannelDto) {
    await this.channelModel.update(updateChannelDto, { where: { id } });
    return await this.channelModel.findByPk(id);
  }

  remove(id: number) {
    return `This action removes a #${id} channel`;
  }
}
