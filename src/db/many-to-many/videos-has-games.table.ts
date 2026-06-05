import { Table, Model, Column, ForeignKey } from 'sequelize-typescript';
import { Video } from '../../modules/video/entities/video.entity';
import { Game } from '../../modules/game/entities/game.entity';

@Table({
  tableName: 'videos_has_games',
  createdAt: 'created_at',
  updatedAt: false,
})
export class VideosHasGames extends Model {
  @ForeignKey(() => Video)
  @Column({ field: 'video_id' })
  videoId!: number;

  @ForeignKey(() => Game)
  @Column({ field: 'game_id' })
  gameId!: number;
}
