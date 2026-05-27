import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ChannelService } from './channel.service';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import Routes from '../../routes.config';

@Controller(Routes.CHANNELS)
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createChannelDto: CreateChannelDto) {
    return this.channelService.create(createChannelDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('generate')
  generateMissingVideosForAllChannels() {
    return this.channelService.generateMissingVideosForAllChannels();
  }

  @Get()
  findAll() {
    return this.channelService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.channelService.findOneForApi(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('syncAllYoutubeChannels')
  removeRemovedFromYoutube() {
    return this.channelService.syncAllYoutubeChannels();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChannelDto: UpdateChannelDto) {
    return this.channelService.update(+id, updateChannelDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string) {
    return this.channelService.remove(+id);
  }
}
