import { LabsController } from './labs.controller';

describe('LabsController routes (US5)', () => {
  it('exposes only lab summary — no Index-specific benchmark route', () => {
    const proto = LabsController.prototype as unknown as Record<string, unknown>;
    const methodNames = Object.getOwnPropertyNames(proto).filter(
      (name) => name !== 'constructor' && typeof proto[name] === 'function',
    );

    expect(methodNames).toEqual(['getSummary']);
    expect(methodNames.some((n) => /benchmark/i.test(n))).toBe(false);
  });
});
