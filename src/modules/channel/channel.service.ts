import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Channel } from './entities/channel.entity';
import { Video } from '../video/entities/video.entity';
import { YoutubeService } from '../youtube/youtube.service';

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(Channel)
    private channelModel: typeof Channel,
    private readonly youtubeService: YoutubeService,
  ) {}

  private readonly logger = new Logger(ChannelService.name);

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    this.logger.log(
      `Creating channel with YouTube handle: ${createChannelDto.youtubeHandle}`,
    );
    const channelInfo = await this.youtubeService.getYtChannelInfosByHandle(
      createChannelDto.youtubeHandle,
    );
    if (channelInfo) {
      this.logger.log(
        `Channel found: ${channelInfo.snippet.title} (ID: ${channelInfo.id})`,
      );
    }

    const channel = await this.channelModel.create({
      ...createChannelDto,
      youtubeId: channelInfo.id,
      name: channelInfo.snippet.title,
      description: channelInfo.snippet.description,
      thumbnailUrl: channelInfo.snippet.thumbnails.default.url,
      youtubeUploadsId: channelInfo.contentDetails.relatedPlaylists.uploads,
    });

    // Trigger video population after the channel is created
    this.logger.log(
      `Populating videos for channel: ${createChannelDto.youtubeHandle} (ID: ${channel.id})`,
    );
    await this._populateVideosForChannel(channel);

    return channel;
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

  private async _populateVideosForChannel(channel: Channel): Promise<void> {
    const plainChannel = channel.get({ plain: true }) as Channel;

    const videos = await this.youtubeService.getAllVideosFromChannel(
      plainChannel.youtubeUploadsId,
    );

    const ignorePatterns: RegExp[] =
      plainChannel.ignoreEpisodesContaining?.map((patternStr) => {
        const regexMatch = patternStr.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
          try {
            return new RegExp(regexMatch[1], regexMatch[2]);
          } catch {
            return /a^/;
          }
        }
        return /a^/;
      }) || [];

    let ignoredVideosCount = 0;

    const videoEntities = videos
      .map((video) => ({
        title: video.title,
        description: video.description,
        youtubeId: video.videoId,
        releaseDate: new Date(video.publishedAt),
        validated: false,
        gamesFoundCount: 0,
        gamesCount: 0,
        ytChannelId: channel.id,
      }))
      .filter((video) => {
        if (ignorePatterns.some((regex) => regex.test(video.title))) {
          this.logger.log(`Ignoring video "${video.title}"`);
          ignoredVideosCount++;
        }
        return !ignorePatterns.some((regex) => regex.test(video.title));
      });

    this.logger.log(
      `Found ${videos.length} videos for channel ${channel.name}`,
    );
    this.logger.log(
      `Ignored ${ignoredVideosCount} videos based on ignore patterns`,
    );

    await Video.bulkCreate(videoEntities, { ignoreDuplicates: false });
  }
}
