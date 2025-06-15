import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SequelizeModule } from '@nestjs/sequelize';
import { ChannelModule } from './modules/channel/channel.module';
import { VideoModule } from './modules/video/video.module';
import { UserModule } from './modules/user/user.module';
import { GameModule } from './modules/game/game.module';
import { AuthModule } from './modules/auth/auth.module';
import { YoutubeService } from './modules/youtube/youtube.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // load env and make ConfigService global
    SequelizeModule.forRootAsync({
      imports: [ConfigModule], // ensure ConfigModule is imported here too
      useFactory: (configService: ConfigService) => {
        return {
          autoLoadModels: true,
          synchronize: true,
          sync: { alter: true },
          dialect: 'mysql',
          host: configService.get<string>('DB_HOST'),
          port: Number(configService.get<number>('DB_PORT')),
          username: configService.get<string>('DB_USERNAME'),
          password: configService.get<string>('DB_PASSWORD'),
          database: configService.get<string>('DB_DATABASE_NAME'),
        };
      },
      inject: [ConfigService],
    }),
    ChannelModule,
    VideoModule,
    UserModule,
    GameModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, YoutubeService],
})
export class AppModule {}
