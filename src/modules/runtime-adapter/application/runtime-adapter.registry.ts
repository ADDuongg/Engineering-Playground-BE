import { ErrorCode, RuntimeAdapterType } from '@db-play/types';
import { DomainError } from '../../../common/errors/domain.error';
import { RuntimeAdapter } from '../domain/runtime-adapter';

/**
 * Resolves a Runtime Adapter by its {@link RuntimeAdapterType}. Adapters are
 * injected at module construction; adding a Track means registering one more
 * adapter — no changes here or to the experiment lifecycle.
 */
export class RuntimeAdapterRegistry {
  private readonly adapters = new Map<RuntimeAdapterType, RuntimeAdapter>();

  constructor(adapters: RuntimeAdapter[]) {
    for (const adapter of adapters) {
      if (this.adapters.has(adapter.type)) {
        throw new Error(
          `Duplicate runtime adapter registered for type "${adapter.type}"`,
        );
      }
      this.adapters.set(adapter.type, adapter);
    }
  }

  resolve(type: RuntimeAdapterType): RuntimeAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) {
      throw new DomainError(
        ErrorCode.NOT_FOUND,
        `No runtime adapter registered for type "${type}"`,
        404,
        { type, registered: this.list() },
      );
    }
    return adapter;
  }

  has(type: RuntimeAdapterType): boolean {
    return this.adapters.has(type);
  }

  list(): RuntimeAdapterType[] {
    return [...this.adapters.keys()];
  }
}
