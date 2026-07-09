export interface LabPathItem {
  slug: string;
  title: string;
  description?: string | null;
  sequenceOrder: number;
}

export interface TrackLearningPathResponse {
  trackSlug: string;
  labs: LabPathItem[];
}

export interface TrackProgressLabItem extends LabPathItem {
  completed: boolean;
}

export interface TrackProgressSummaryResponse {
  trackSlug: string;
  totalLabs: number;
  completedCount: number;
  percentComplete: number;
  completedLabSlugs: string[];
  labs: TrackProgressLabItem[];
}

export interface CompleteLabResult {
  labSlug: string;
  trackSlug: string;
  completedAt: string;
  alreadyCompleted: boolean;
}
