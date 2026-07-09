export const LAB_COMPLETED_EVENT = 'lab.completed';

export interface LabCompletedEvent {
  userId: string;
  labSlug: string;
  trackSlug: string;
  completedAt: string;
}
