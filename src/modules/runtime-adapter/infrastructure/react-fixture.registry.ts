import { Injectable } from '@nestjs/common';
import { ReactFixture } from '../domain/react-fixture';
import { renderingCounterFixture } from './fixtures/rendering-counter.fixture';
import {
  keysListFixture,
  reconciliationWrapperFixture,
} from './fixtures/list-reconciliation.fixture';
import { closureStaleIntervalFixture } from './fixtures/closure-stale.fixture';
import { hooksOrderFixture } from './fixtures/hooks-order.fixture';

@Injectable()
export class ReactFixtureRegistry {
  private readonly fixtures = new Map<string, ReactFixture>();

  constructor() {
    for (const fixture of [
      renderingCounterFixture,
      reconciliationWrapperFixture,
      keysListFixture,
      closureStaleIntervalFixture,
      hooksOrderFixture,
    ]) {
      this.fixtures.set(fixture.id, fixture);
    }
  }

  get(id: string): ReactFixture | undefined {
    return this.fixtures.get(id);
  }

  has(id: string): boolean {
    return this.fixtures.has(id);
  }

  listIds(): string[] {
    return [...this.fixtures.keys()];
  }
}
