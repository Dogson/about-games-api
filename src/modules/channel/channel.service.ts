import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Channel } from './entities/channel.entity';
import { Video } from '../video/entities/video.entity';
import { YoutubeService } from '../youtube/youtube.service';
import { VideoService } from '../video/video.service';

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(Channel)
    private channelModel: typeof Channel,
    private readonly youtubeService: YoutubeService,
    private readonly videoService: VideoService,
  ) {}

  private readonly logger = new Logger(ChannelService.name);

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    // check if channel with the same YouTube handle already exists
    const existingChannel = await this.channelModel.findOne({
      where: { youtubeHandle: createChannelDto.youtubeHandle },
    });
    if (existingChannel) {
      throw new BadRequestException(
        `Video with YouTube Handle ${createChannelDto.youtubeHandle} already exists`,
      );
    }

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
      `Populating videos for channel: ${channel.get('youtubeHandle')} (ID: ${channel.id})`,
    );
    void this._populateVideosForChannel(channel);

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

  async generateMissingVideosForAllChannels() {
    this.logger.log('Generating missing videos for all channels...');
    const channels = await this.channelModel.findAll({
      include: [{ model: Video }],
    });

    for (const channel of channels) {
      try {
        await this._populateVideosForChannel(channel);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error(
            `Failed to populate videos for channel "${channel.get('name')}": ${error.message}`,
          );
        } else {
          // Fallback for unknown error shapes
          this.logger.error(
            `Failed to populate videos for channel "${channel.get('name')}": ${String(error)}`,
          );
        }
      }
    }
  }

  async syncAllChannelsVideosFromYoutube() {
    this.logger.log('Removing all deleted videos from all channels...');

    const channels = await this.channelModel.findAll({
      include: [{ model: Video }],
    });

    for (const channel of channels) {
      await this.videoService.syncVideosFromYoutube(channel);
    }
  }

  private async _populateVideosForChannel(channel: Channel): Promise<void> {
    const plainChannel = channel.get({ plain: true }) as Channel;

    const videos = await this.youtubeService.getAllVideosFromChannel(
      plainChannel.youtubeUploadsId,
    );

    const existingVideos = channel.get('videos') || [];

    const newVideos = videos.filter(
      (video) =>
        !existingVideos.some(
          (existingVideo: Video) =>
            existingVideo.get('youtubeId') === video.videoId,
        ),
    );

    const ignoreContainingPattern: RegExp[] =
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

    const ignoreMissingPatterns: (RegExp | string)[] =
      plainChannel.ignoreEpisodesMissing?.map((patternStr) => {
        const regexMatch = patternStr.match(/^\/(.+)\/([gimsuy]*)$/);
        if (regexMatch) {
          try {
            return new RegExp(regexMatch[1], regexMatch[2]);
          } catch {
            return ''; // won't match anything
          }
        }
        return patternStr; // treat as simple substring
      }) || [];

    let ignoredVideosCount = 0;

    const videoDtos = newVideos
      .map((video) => ({
        title: video.title,
        description: video.description,
        youtubeId: video.videoId,
        releaseDate: video.publishedAt,
        validated: false,
        thumbnailUrl: video.thumbnailUrl,
        gamesFoundCount: 0,
        gamesCount: 0,
        ytChannelId: channel.id,
      }))
      .filter((video) => {
        const title = video.title;

        // Ignore if title matches any "ignoreEpisodesContaining" pattern
        if (ignoreContainingPattern.some((regex) => regex.test(title))) {
          ignoredVideosCount++;
          return false;
        }

        // Ignore if title does NOT contain ANY of the "ignoreEpisodesMissing" patterns
        // That is, if none of these patterns appear in the title, ignore video
        if (ignoreMissingPatterns.length > 0) {
          const containsAny = ignoreMissingPatterns.some((pattern) => {
            if (pattern instanceof RegExp) {
              return pattern.test(title);
            }
            return title.includes(pattern);
          });
          if (!containsAny) {
            ignoredVideosCount++;
            return false;
          }
        }

        // Otherwise keep the video
        return true;
      });

    this.logger.log(
      `Found ${newVideos.length} videos for channel ${channel.get('name')}`,
    );
    this.logger.log(
      `Ignored ${ignoredVideosCount} videos based on ignore patterns`,
    );

    for (const videoDto of videoDtos) {
      try {
        await this.videoService.create(videoDto);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error(
            `Failed to create video "${videoDto.title}": ${error.message}`,
          );
        } else {
          // Fallback for unknown error shapes
          this.logger.error(
            `Failed to create video "${videoDto.title}": ${String(error)}`,
          );
        }
      }
    }
  }
}
