import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto } from './dto/create-game.dto';
import { UpdateGameDto } from './dto/update-game.dto';
import Routes from '../../routes.config';
import { FindAllGamesDto } from './dto/find-all-games.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(Routes.GAMES)
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() createGameDto: CreateGameDto) {
    return this.gameService.create(createGameDto);
  }

  @Get()
  findAll(@Query() query: FindAllGamesDto) {
    return this.gameService.findAll(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('igdbSearch')
  igdbSearch(@Query('search') search: string) {
    return this.gameService.igdbSearch(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gameService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('syncAllGames')
  syncAllGames() {
    return this.gameService.syncAllGamesWithIgdb();
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGameDto: UpdateGameDto) {
    return this.gameService.update(+id, updateGameDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gameService.remove(+id);
  }
}
