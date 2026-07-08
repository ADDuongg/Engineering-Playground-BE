import { TrackStatus } from './track-status.enum';

export interface TrackSummary {
  slug: string;
  name: string;
  description: string;
  status: TrackStatus;
  displayOrder: number;
}

export interface TrackListResponse {
  tracks: TrackSummary[];
}
