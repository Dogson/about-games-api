import { Injectable, NotFoundException } from '@nestjs/common';
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
    // todo should get this stuff from a youtube.service
    const stuffToGetFromYoutubeApi = {
      thumbnail: 'Blabli',
      name: Date.now(),
      description: 'blabla',
      language: 'fr',
    };

    return await this.channelModel.create({
      ...createChannelDto,
      ...stuffToGetFromYoutubeApi,
    });
  }

  async findAll(): Promise<Channel[]> {
    return await this.channelModel.findAll({
      include: [{ model: Video }],
    });
  }

  async findOne(id: number): Promise<Channel> {
    const channel = await this.channelModel.findByPk(id, {
      include: [{ model: Video }],
    });
    if (!channel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }
    return channel;
  }

  async update(
    id: number,
    updateChannelDto: UpdateChannelDto,
  ): Promise<Channel> {
    const existingChannel = await this.channelModel.findByPk(id);

    if (!existingChannel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }

    await this.channelModel.update(updateChannelDto, {
      where: { id },
    });

    const updatedChannel = await this.channelModel.findByPk(id);
    return updatedChannel!;
  }

  async remove(id: number): Promise<void> {
    const deletedRows = await this.channelModel.destroy({ where: { id } });
    if (deletedRows === 0) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }
  }
}
