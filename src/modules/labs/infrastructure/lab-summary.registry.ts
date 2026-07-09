import { Injectable } from '@nestjs/common';
import {
  INDEX_PLAYGROUND_CONTENT,
  INDEX_PLAYGROUND_SLUG,
  LabSummaryContent,
} from './lab-summary.content';

@Injectable()
export class LabSummaryRegistry {
  private readonly bySlug: ReadonlyMap<string, LabSummaryContent>;

  constructor() {
    this.bySlug = new Map([[INDEX_PLAYGROUND_SLUG, INDEX_PLAYGROUND_CONTENT]]);
  }

  getByLabSlug(labSlug: string): LabSummaryContent | null {
    return this.bySlug.get(labSlug) ?? null;
  }
}
