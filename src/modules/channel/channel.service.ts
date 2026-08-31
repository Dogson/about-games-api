import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { InjectModel } from '@nestjs/sequelize';
import { Channel } from './entities/channel.entity';
import { Video } from '../video/entities/video.entity';
import { YoutubeService } from '../youtube/youtube.service';
import { VideoService } from '../video/video.service';
import { Sequelize } from 'sequelize';
import { ChannelResponseDto } from './dto/channel-response.dto';
import { AppLogger } from '../logging/app-logger.service';
import { createProgressBar } from 'src/helpers/ascii/progressBar';

@Injectable()
export class ChannelService {
  constructor(
    @InjectModel(Channel)
    private channelModel: typeof Channel,
    @InjectModel(Video)
    private videoModel: typeof Video,
    private readonly youtubeService: YoutubeService,
    private readonly videoService: VideoService,
    private readonly appLogger: AppLogger,
  ) {}

  async create(
    createChannelDto: CreateChannelDto,
  ): Promise<ChannelResponseDto> {
    // check if channel with the same YouTube handle already exists
    const existingChannel = await this.channelModel.findOne({
      where: { youtubeHandle: createChannelDto.youtubeHandle },
    });
    if (existingChannel) {
      throw new BadRequestException(
        `Video with YouTube Handle ${createChannelDto.youtubeHandle} already exists`,
      );
    }

    this.appLogger.log(
      `Creating channel with YouTube handle: ${createChannelDto.youtubeHandle}`,
    );
    const channelInfo = await this.youtubeService.getYtChannelInfosByHandle(
      createChannelDto.youtubeHandle,
    );
    if (channelInfo) {
      this.appLogger.log(
        `Channel found: ${channelInfo.snippet.title} (ID: ${channelInfo.id})`,
      );
    }

    // Flatten parsingOptions if provided
    const channelData = this._flattenParsingOptions(createChannelDto);

    const channel = await this.channelModel.create({
      ...channelData,
      youtubeId: channelInfo.id,
      name: channelInfo.snippet.title,
      description: channelInfo.snippet.description,
      thumbnailUrl: channelInfo.snippet.thumbnails.default.url,
      youtubeUploadsId: channelInfo.contentDetails.relatedPlaylists.uploads,
    });

    // Trigger video population after the channel is created
    this.appLogger.log(
      `Populating videos for channel: ${channel.get('youtubeHandle')} (ID: ${channel.id})`,
    );
    void this._populateVideosForChannel(channel);

    // Get video count for the newly created channel
    const channelWithCount = await this.channelModel.findByPk(channel.id, {
      attributes: {
        include: [
          [Sequelize.fn('COUNT', Sequelize.col('videos.id')), 'videosCount'],
        ],
      },
      include: [
        {
          model: Video,
          attributes: [],
          required: false,
        },
      ],
      group: ['Channel.id'],
    });
    return this._transformChannelResponse(channelWithCount!);
  }

  async findAll(): Promise<ChannelResponseDto[]> {
    const channels = await this.channelModel.findAll({
      attributes: {
        include: [
          [Sequelize.fn('COUNT', Sequelize.col('videos.id')), 'videosCount'],
        ],
      },
      include: [
        {
          model: Video,
          attributes: [],
          required: false,
        },
      ],
      group: ['Channel.id'],
    });

    return channels.map((channel) => this._transformChannelResponse(channel));
  }

  private _transformChannelResponse(channel: Channel): ChannelResponseDto {
    const plainChannel = channel.get({ plain: true }) as Channel & {
      videosCount?: number;
    };
    const { ignoreEpisodesContaining, ignoreEpisodesMissing, videos, ...rest } =
      plainChannel;

    const result: ChannelResponseDto = {
      ...rest,
      parsingOptions: {
        ignoreEpisodesContaining,
        ignoreEpisodesMissing,
      },
    };

    // If videos array is present, include it; otherwise use videosCount
    if (videos !== undefined) {
      result.videos = videos;
    } else {
      result.videosCount = plainChannel.videosCount ?? 0;
    }

    return result;
  }

  async findOne(id: number): Promise<Channel> {
    const channel = await this.channelModel.findByPk(id);
    if (!channel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }
    return channel;
  }

  async findOneForApi(id: number): Promise<ChannelResponseDto> {
    const channel = await this.channelModel.findByPk(id, {
      include: [{ model: Video }],
    });
    if (!channel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }
    return this._transformChannelResponse(channel);
  }

  async update(
    id: number,
    updateChannelDto: UpdateChannelDto,
  ): Promise<ChannelResponseDto> {
    const existingChannel = await this.channelModel.findByPk(id);

    if (!existingChannel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }

    // Flatten parsingOptions if provided
    const updateData = this._flattenParsingOptions(updateChannelDto);

    await this.channelModel.update(updateData, {
      where: { id },
    });

    const updatedChannel = await this.channelModel.findByPk(id, {
      attributes: {
        include: [
          [Sequelize.fn('COUNT', Sequelize.col('videos.id')), 'videosCount'],
        ],
      },
      include: [
        {
          model: Video,
          attributes: [],
          required: false,
        },
      ],
      group: ['Channel.id'],
    });
    return this._transformChannelResponse(updatedChannel!);
  }

  private _flattenParsingOptions(
    dto: CreateChannelDto | UpdateChannelDto,
  ): Partial<Channel> {
    const { parsingOptions, ...rest } = dto;
    if (parsingOptions) {
      return {
        ...rest,
        ignoreEpisodesContaining: parsingOptions.ignoreEpisodesContaining,
        ignoreEpisodesMissing: parsingOptions.ignoreEpisodesMissing,
      };
    }
    return rest;
  }

  async remove(id: number): Promise<void> {
    const channel = await this.channelModel.findByPk(id, {
      include: [{ model: Video }],
    });

    if (!channel) {
      throw new NotFoundException(`Channel with id ${id} not found`);
    }

    // Delete all videos associated with this channel
    const videos = channel.get('videos') || [];
    if (videos.length > 0) {
      this.appLogger.log(
        `Deleting ${videos.length} videos for channel "${channel.get('name')}" (ID: ${id})`,
      );
      await this.videoModel.destroy({
        where: { ytChannelId: id },
      });
    }

    // Delete the channel
    await this.channelModel.destroy({ where: { id } });
    this.appLogger.log(
      `Channel "${channel.get('name')}" (ID: ${id}) deleted successfully`,
    );
  }

  async generateMissingVideosForAllChannels() {
    this.appLogger.log('Generating missing videos for all channels...');
    const channels = await this.channelModel.findAll({
      include: [{ model: Video }],
    });

    for (const channel of channels) {
      try {
        await this._populateVideosForChannel(channel);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.appLogger.error(
            `Failed to populate videos for channel "${channel.get('name')}": ${error.message}`,
          );
        } else {
          // Fallback for unknown error shapes
          this.appLogger.error(
            `Failed to populate videos for channel "${channel.get('name')}": ${String(error)}`,
          );
        }
      }
    }
  }

  async generateGamesForChannel(channelId: number): Promise<{
    success: boolean;
    message: string;
    updated: number;
  }> {
    const channel = await this.channelModel.findByPk(channelId);

    if (!channel) {
      throw new NotFoundException(`Channel with id ${channelId} not found`);
    }

    const unsearchedCount = await this.videoModel.count({
      where: { ytChannelId: channelId, hasSearchedGames: false },
    });

    if (unsearchedCount > 0) {
      void this._processGameGeneration(channelId);
    }

    return {
      success: true,
      message:
        unsearchedCount > 0
          ? 'Game generation started'
          : 'No unsearched videos found for this channel',
      updated: unsearchedCount,
    };
  }

  private async _processGameGeneration(channelId: number): Promise<void> {
    const channel = await this.channelModel.findByPk(channelId);
    if (!channel) return;

    const videos = await this.videoModel.findAll({
      where: { ytChannelId: channelId, hasSearchedGames: false },
    });

    this.appLogger.log(
      `Generating games for ${videos.length} unsearched videos in channel "${channel.get('name')}"`,
    );

    let updatedCount = 0;
    for (const video of videos) {
      try {
        await this.videoService.regenerateGamesForVideo(video);
        updatedCount++;
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.appLogger.error(
            `Failed to generate games for video "${video.get('title')}": ${error.message}`,
          );
        } else {
          this.appLogger.error(
            `Failed to generate games for video "${video.get('title')}": ${String(error)}`,
          );
        }
      }
    }

    this.appLogger.log(
      `Successfully generated games for ${updatedCount}/${videos.length} videos in channel "${channel.get('name')}"`,
    );
  }

  async syncAllYoutubeChannels() {
    const channels = await this.channelModel.findAll({
      include: [{ model: Video }],
    });

    this.appLogger.log('Updating all channels infos from Youtube...');
    for (const channel of channels) {
      await this._syncChannelFromYoutube(channel);
    }

    this.appLogger.log('Removing all deleted videos from all channels...');
    for (const channel of channels) {
      await this.videoService.syncVideosFromYoutube(channel);
    }

    this.appLogger.log('Purging all Shorts videos from all channels...');
    for (const channel of channels) {
      await this.videoService.purgeShortsFromChannel(channel);
    }

    this.appLogger.log('Generating games for unsearched videos...');
    for (const channel of channels) {
      const unsearchedCount = await this.videoModel.count({
        where: { ytChannelId: channel.id, hasSearchedGames: false },
      });
      if (unsearchedCount > 0) {
        await this._processGameGeneration(channel.id);
      }
    }
  }

  private async _syncChannelFromYoutube(channel: Channel): Promise<void> {
    try {
      const channelInfo = await this.youtubeService.getYtChannelInfosById(
        channel.youtubeId,
      );

      const syncedData = {
        name: channelInfo.snippet.title,
        description: channelInfo.snippet.description,
        thumbnailUrl: channelInfo.snippet.thumbnails.default.url,
      };

      channel.set(syncedData);

      const changedFields = channel.changed();

      if (changedFields) {
        this.appLogger.log(`Updated channel ${channel.name}:`);
        for (const field of changedFields) {
          this.appLogger.log(
            `${field}: "${channel.previous(field)}" -> "${channel.get(field) as string}"`,
          );
        }
        await channel.save();
      }
    } catch (error) {
      this.appLogger.error(
        `Error while fetching infos for channel ${channel.name}`,
        error,
      );
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
        ignored: false,
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

    let shortsCount = 0;
    await Promise.all(
      videoDtos.map(async (video) => {
        if (await this.youtubeService.isYoutubeShort(video.youtubeId)) {
          video.ignored = true;
          shortsCount++;
        }
      }),
    );

    this.appLogger.log(
      `Found ${newVideos.length} videos for channel ${channel.get('name')}`,
    );
    this.appLogger.log(
      `Ignored ${ignoredVideosCount} videos based on ignore patterns`,
    );
    this.appLogger.log(
      `Detected ${shortsCount} Shorts videos marked as ignored`,
    );

    let videoIndex = 0;
    for (const videoDto of videoDtos) {
      this.appLogger.log(
        `${channel.name} : Vidéo ${videoIndex + 1} / ${videoDtos.length} ${createProgressBar(videoIndex + 1, videoDtos.length)}`,
      );
      try {
        await this.videoService.create(videoDto);
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.appLogger.error(
            `Failed to create video "${videoDto.title}": ${error.message}`,
          );
        } else {
          // Fallback for unknown error shapes
          this.appLogger.error(
            `Failed to create video "${videoDto.title}": ${String(error)}`,
          );
        }
      }
      videoIndex += 1;
    }
  }
}
