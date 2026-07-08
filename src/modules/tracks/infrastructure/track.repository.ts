import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrackEntity } from '../entities/track.entity';

@Injectable()
export class TrackRepository {
  constructor(
    @InjectRepository(TrackEntity, 'platform')
    private readonly repository: Repository<TrackEntity>,
  ) {}

  async findAllOrdered(): Promise<TrackEntity[]> {
    return this.repository.find({
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<TrackEntity | null> {
    return this.repository.findOne({ where: { slug } });
  }
}
