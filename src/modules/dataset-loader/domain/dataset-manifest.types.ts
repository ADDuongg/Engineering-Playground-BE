import { DatasetTier } from '@db-play/types';

export interface DatasetTableManifest {
  name: string;
  label: string;
  description: string;
  targetRowCount: number;
}

export interface DatasetTierManifest {
  id: DatasetTier;
  seedPath: string;
  tables: DatasetTableManifest[];
}

export interface DatasetVersionManifest {
  id: string;
  schemaPath: string;
  tiers: DatasetTierManifest[];
}

export interface DatasetFamilyManifest {
  id: string;
  label: string;
  description: string;
  versions: DatasetVersionManifest[];
}

export interface DatasetManifest {
  families: DatasetFamilyManifest[];
}

export interface ResolvedDatasetIdentity {
  family: DatasetFamilyManifest;
  version: DatasetVersionManifest;
  tier: DatasetTierManifest;
}
