import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  InputSurfaceType,
  RuntimeAdapterType,
  TrackStatus,
} from '@db-play/types';

@Entity('tracks')
export class TrackEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'enum', enum: TrackStatus })
  status!: TrackStatus;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'runtime_adapter_type', type: 'enum', enum: RuntimeAdapterType })
  runtimeAdapterType!: RuntimeAdapterType;

  @Column({ name: 'input_surface_type', type: 'enum', enum: InputSurfaceType })
  inputSurfaceType!: InputSurfaceType;

  @Column({ name: 'metric_catalog_id', type: 'varchar', length: 64 })
  metricCatalogId!: string;

  @Column({ name: 'visualization_kit_id', type: 'varchar', length: 64 })
  visualizationKitId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
