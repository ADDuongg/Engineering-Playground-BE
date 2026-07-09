import { JobStatus } from '../jobs/job-status.enum';
import { DatasetTier } from './dataset-tier.enum';

export interface ResetDatasetResult {
  jobId: string;
  jobType: 'dataset-reset';
  status: JobStatus.QUEUED;
  createdAt: string;
  family: string;
  version: string;
  tier: DatasetTier;
}
