import { INDEX_PLAYGROUND_CONTENT } from './lab-summary.content';
import { LabSummaryRegistry } from './lab-summary.registry';

describe('INDEX_PLAYGROUND_CONTENT', () => {
  it('targets users.email for guided query and index DDL', () => {
    expect(INDEX_PLAYGROUND_CONTENT.recommendedQuery.sql).toMatch(
      /FROM\s+users/i,
    );
    expect(INDEX_PLAYGROUND_CONTENT.recommendedQuery.sql).toMatch(/email\s*=\s*\$1/i);
    expect(INDEX_PLAYGROUND_CONTENT.recommendedQuery.exampleParameters).toEqual([
      'user1@example.com',
    ]);
    expect(
      INDEX_PLAYGROUND_CONTENT.recommendedQuery.exampleParameters.length,
    ).toBeGreaterThan(0);
    expect(INDEX_PLAYGROUND_CONTENT.recommendedCreateIndexSql).toMatch(
      /CREATE\s+INDEX/i,
    );
    expect(INDEX_PLAYGROUND_CONTENT.recommendedCreateIndexSql).toMatch(
      /ON\s+users\s*\(\s*email\s*\)/i,
    );
    expect(INDEX_PLAYGROUND_CONTENT.recommendedDropIndexSql).toMatch(
      /DROP\s+INDEX/i,
    );
    expect(INDEX_PLAYGROUND_CONTENT.recommendedDropIndexSql).toMatch(
      /idx_users_email/,
    );
  });

  it('includes run_sql, create_index_sql, and drop_index_sql steps', () => {
    const actions = INDEX_PLAYGROUND_CONTENT.guidedSteps.map((s) => s.action);
    expect(actions).toEqual(expect.arrayContaining(['run_sql']));
    expect(actions).toEqual(expect.arrayContaining(['create_index_sql']));
    expect(actions).toEqual(expect.arrayContaining(['drop_index_sql']));
  });

  it('includes explain before and after create-index', () => {
    const steps = [...INDEX_PLAYGROUND_CONTENT.guidedSteps].sort(
      (a, b) => a.order - b.order,
    );
    const createIdx = steps.findIndex((s) => s.action === 'create_index_sql');
    expect(createIdx).toBeGreaterThan(-1);

    const explainBefore = steps
      .slice(0, createIdx)
      .some(
        (s) =>
          s.action === 'run_explain' || s.action === 'run_explain_analyze',
      );
    const explainAfter = steps
      .slice(createIdx + 1)
      .some(
        (s) =>
          s.action === 'run_explain' || s.action === 'run_explain_analyze',
      );

    expect(explainBefore).toBe(true);
    expect(explainAfter).toBe(true);
  });

  it('requires quiz and includes take_quiz step', () => {
    expect(INDEX_PLAYGROUND_CONTENT.quizRequired).toBe(true);
    expect(
      INDEX_PLAYGROUND_CONTENT.guidedSteps.some((s) => s.action === 'take_quiz'),
    ).toBe(true);
    expect(INDEX_PLAYGROUND_CONTENT.theory.toLowerCase()).toMatch(/quiz/);
  });

  it('includes optional benchmark note and step when note present', () => {
    expect(INDEX_PLAYGROUND_CONTENT.optionalBenchmarkNote).toBeTruthy();
    expect(
      INDEX_PLAYGROUND_CONTENT.guidedSteps.some(
        (s) => s.action === 'optional_benchmark',
      ),
    ).toBe(true);
  });
});

describe('LabSummaryRegistry', () => {
  it('resolves index-playground and returns null for unknown', () => {
    const registry = new LabSummaryRegistry();
    expect(registry.getByLabSlug('index-playground')).toBe(
      INDEX_PLAYGROUND_CONTENT,
    );
    expect(registry.getByLabSlug('missing-lab')).toBeNull();
  });
});
