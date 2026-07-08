import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TracksController } from './tracks.controller';
import { TrackEntity } from './entities/track.entity';
import { TrackRepository } from './infrastructure/track.repository';
import { ListTracksUseCase } from './application/list-tracks.usecase';
import { GetTrackBySlugUseCase } from './application/get-track-by-slug.usecase';

@Module({
  imports: [TypeOrmModule.forFeature([TrackEntity], 'platform')],
  controllers: [TracksController],
  providers: [TrackRepository, ListTracksUseCase, GetTrackBySlugUseCase],
  exports: [TrackRepository, ListTracksUseCase, GetTrackBySlugUseCase],
})
export class TracksModule {}
