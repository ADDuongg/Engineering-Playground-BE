import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seeds the Frontend React track (React Fundamentals) with labs, curricula,
 * guided steps and quizzes.
 *
 * Design notes:
 * - The executable "logic" for React lives entirely in `lab_guided_steps.payload`
 *   (jsonb) under `reactScenario`. The shared curriculum columns
 *   (`recommended_query`, `dataset`) stay Database/SQL-specific, so React labs
 *   store a neutral placeholder query + a "none" dataset hint to satisfy the
 *   current NOT NULL constraints. Relaxing those columns + a dedicated `config`
 *   column is the follow-up decoupling step.
 * - Idempotent: track/labs use ON CONFLICT (slug); curriculum/steps/quiz inserts
 *   are guarded by existence checks per lab.
 */
export class SeedFrontendReactTrack1731100000000 implements MigrationInterface {
  name = 'SeedFrontendReactTrack1731100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Track
    await queryRunner.query(`
      INSERT INTO "tracks" (
        "slug", "name", "description", "status", "display_order",
        "runtime_adapter_type", "input_surface_type",
        "metric_catalog_id", "visualization_kit_id"
      ) VALUES (
        'frontend-react',
        'Frontend React',
        'Learn how React works under the hood: rendering, reconciliation, keys, closures, and hooks through hands-on component experiments.',
        'active',
        4,
        'headless_react_sandbox',
        'component_sandbox',
        'react-metrics',
        'react-viz'
      )
      ON CONFLICT ("slug") DO NOTHING
    `);

    const trackRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM tracks WHERE slug = 'frontend-react' LIMIT 1`,
    );
    if (trackRows.length === 0) {
      throw new Error('Track "frontend-react" was not created');
    }
    const trackId = trackRows[0].id;

    // Neutral placeholders for Database/SQL-only curriculum columns.
    const emptyQuery = {
      sql: '',
      exampleParameters: [] as unknown[],
      paramHints: [] as string[],
      description: '',
    };
    const noDataset = { family: 'none', version: 'v1', recommendedTier: [] as string[] };

    for (const lab of REACT_LABS) {
      // 2. Lab
      await queryRunner.query(
        `
        INSERT INTO "labs" ("slug", "title", "description", "track_id", "sequence_order", "status")
        VALUES ($1, $2, $3, $4, $5, 'active')
        ON CONFLICT ("slug") DO NOTHING
        `,
        [lab.slug, lab.title, lab.description, trackId, lab.sequenceOrder],
      );

      const labRows: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM labs WHERE slug = $1 LIMIT 1`,
        [lab.slug],
      );
      if (labRows.length === 0) {
        throw new Error(`Lab "${lab.slug}" was not created`);
      }
      const labId = labRows[0].id;

      // 3. Curriculum (guarded)
      const curriculumCount: Array<{ cnt: string }> = await queryRunner.query(
        `SELECT COUNT(*)::text AS cnt FROM lab_summary_curricula WHERE lab_id = $1`,
        [labId],
      );
      if (Number(curriculumCount[0]?.cnt ?? 0) === 0) {
        await queryRunner.query(
          `
          INSERT INTO lab_summary_curricula (
            lab_id, learning_goal, theory,
            recommended_query, recommended_create_index_sql, recommended_drop_index_sql,
            dataset, quiz_required, optional_benchmark_note
          ) VALUES ($1, $2, $3, $4::jsonb, NULL, NULL, $5::jsonb, true, NULL)
          `,
          [
            labId,
            lab.learningGoal,
            lab.theory,
            JSON.stringify(emptyQuery),
            JSON.stringify(noDataset),
          ],
        );
      }

      // 4. Guided steps (guarded)
      const stepCount: Array<{ cnt: string }> = await queryRunner.query(
        `SELECT COUNT(*)::text AS cnt FROM lab_guided_steps WHERE lab_id = $1`,
        [labId],
      );
      if (Number(stepCount[0]?.cnt ?? 0) === 0) {
        for (const step of lab.steps) {
          await queryRunner.query(
            `
            INSERT INTO lab_guided_steps (lab_id, display_order, title, instruction, action, payload)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb)
            `,
            [
              labId,
              step.order,
              step.title,
              step.instruction,
              step.action,
              step.payload === null ? null : JSON.stringify(step.payload),
            ],
          );
        }
      }

      // 5. Quiz + questions + options (guarded)
      await queryRunner.query(
        `
        INSERT INTO "quizzes" ("lab_id", "title")
        VALUES ($1, $2)
        ON CONFLICT ("lab_id") DO NOTHING
        `,
        [labId, `${lab.title} Quiz`],
      );

      const quizRows: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM quizzes WHERE lab_id = $1 LIMIT 1`,
        [labId],
      );
      const quizId = quizRows[0].id;

      const questionCount: Array<{ cnt: string }> = await queryRunner.query(
        `SELECT COUNT(*)::text AS cnt FROM quiz_questions WHERE quiz_id = $1`,
        [quizId],
      );
      if (Number(questionCount[0]?.cnt ?? 0) === 0) {
        let questionOrder = 1;
        for (const q of lab.quiz) {
          const insertedQuestion: Array<{ id: string }> = await queryRunner.query(
            `
            INSERT INTO "quiz_questions" ("quiz_id", "prompt", "question_type", "sequence_order")
            VALUES ($1, $2, 'single_select', $3)
            RETURNING id
            `,
            [quizId, q.prompt, questionOrder],
          );
          const questionId = insertedQuestion[0].id;
          let optionOrder = 1;
          for (const opt of q.options) {
            await queryRunner.query(
              `
              INSERT INTO "quiz_options" ("question_id", "label", "sequence_order", "is_correct")
              VALUES ($1, $2, $3, $4)
              `,
              [questionId, opt.label, optionOrder, opt.correct],
            );
            optionOrder += 1;
          }
          questionOrder += 1;
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const slugs = REACT_LABS.map((l) => l.slug);

    const labRows: Array<{ id: string }> = await queryRunner.query(
      `SELECT id FROM labs WHERE slug = ANY($1::varchar[])`,
      [slugs],
    );
    const labIds = labRows.map((r) => r.id);

    if (labIds.length > 0) {
      const quizRows: Array<{ id: string }> = await queryRunner.query(
        `SELECT id FROM quizzes WHERE lab_id = ANY($1::uuid[])`,
        [labIds],
      );
      const quizIds = quizRows.map((r) => r.id);
      if (quizIds.length > 0) {
        const questionRows: Array<{ id: string }> = await queryRunner.query(
          `SELECT id FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])`,
          [quizIds],
        );
        const questionIds = questionRows.map((r) => r.id);
        if (questionIds.length > 0) {
          await queryRunner.query(
            `DELETE FROM quiz_options WHERE question_id = ANY($1::uuid[])`,
            [questionIds],
          );
        }
        await queryRunner.query(
          `DELETE FROM quiz_questions WHERE quiz_id = ANY($1::uuid[])`,
          [quizIds],
        );
        await queryRunner.query(`DELETE FROM quizzes WHERE id = ANY($1::uuid[])`, [
          quizIds,
        ]);
      }

      await queryRunner.query(
        `DELETE FROM lab_guided_steps WHERE lab_id = ANY($1::uuid[])`,
        [labIds],
      );
      await queryRunner.query(
        `DELETE FROM lab_summary_curricula WHERE lab_id = ANY($1::uuid[])`,
        [labIds],
      );
      await queryRunner.query(`DELETE FROM labs WHERE id = ANY($1::uuid[])`, [
        labIds,
      ]);
    }

    await queryRunner.query(`DELETE FROM tracks WHERE slug = 'frontend-react'`);
  }
}

interface ReactQuizQuestion {
  prompt: string;
  options: Array<{ label: string; correct: boolean }>;
}

interface ReactGuidedStep {
  order: number;
  title: string;
  instruction: string;
  action: string;
  payload: Record<string, unknown> | null;
}

interface ReactLabSeed {
  slug: string;
  title: string;
  description: string;
  sequenceOrder: number;
  learningGoal: string;
  theory: string;
  steps: ReactGuidedStep[];
  quiz: ReactQuizQuestion[];
}

const REACT_LABS: ReactLabSeed[] = [
  {
    slug: 'react-rendering',
    title: 'Rendering',
    description:
      'See exactly when React re-renders a component and how state/props changes drive render counts.',
    sequenceOrder: 1,
    learningGoal:
      'Understand what triggers a React render, distinguish "render" from "commit", and reason about render_count when state or props change.',
    theory:
      'A React render is React calling your component function to compute the next element tree. It happens on the initial mount and whenever the component\'s state changes or its parent re-renders (passing new or even the same props). Rendering does not necessarily touch the DOM — the commit phase applies only the differences. In this lab you trigger renders via state and props updates and watch render_count and commit_duration_ms change. Passing the quiz completes the lab.',
    steps: [
      {
        order: 1,
        title: 'Mount the counter',
        instruction:
          'Render the Counter component for the first time. Expect render_count=1 (the initial mount).',
        action: 'render_component',
        payload: {
          reactScenario: {
            scenarioId: 'rendering/counter',
            componentSource:
              'function Counter() {\n  const [count, setCount] = React.useState(0);\n  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;\n}',
            description: 'Initial mount of a simple stateful counter.',
          },
        },
      },
      {
        order: 2,
        title: 'Update state',
        instruction:
          'Click the button to call setCount. Observe a new render (render_count increases) and a commit that updates the button text.',
        action: 'update_state',
        payload: {
          reactScenario: {
            scenarioId: 'rendering/counter',
            interactions: [{ type: 'click', target: 'button' }],
            description: 'State update re-renders the owning component.',
          },
        },
      },
      {
        order: 3,
        title: 'Update props from the parent',
        instruction:
          'Have the parent pass a new label prop. The child re-renders even though its own state did not change.',
        action: 'update_props',
        payload: {
          reactScenario: {
            scenarioId: 'rendering/counter',
            props: { label: 'Clicks' },
            description: 'Prop change from parent re-renders the child.',
          },
        },
      },
      {
        order: 4,
        title: 'Compare render metrics',
        instruction:
          'Compare render_count and commit_duration_ms across the mount, state update and prop update steps.',
        action: 'compare_metrics',
        payload: null,
      },
      {
        order: 5,
        title: 'Take the quiz',
        instruction:
          'Pass the Rendering quiz (100% correct) to mark the lab complete.',
        action: 'take_quiz',
        payload: null,
      },
    ],
    quiz: [
      {
        prompt: 'What causes a React component to re-render?',
        options: [
          { label: 'Its state changes or its parent re-renders', correct: true },
          { label: 'Only when the DOM is manually mutated', correct: false },
          { label: 'Only on a full page reload', correct: false },
        ],
      },
      {
        prompt: 'What is the difference between the render phase and the commit phase?',
        options: [
          {
            label:
              'Render computes the next element tree; commit applies the diff to the DOM',
            correct: true,
          },
          { label: 'They are two names for the same phase', correct: false },
          { label: 'Commit runs before render', correct: false },
        ],
      },
    ],
  },
  {
    slug: 'react-reconciliation',
    title: 'Reconciliation',
    description:
      'Explore how React diffs element trees and decides whether to update or remount a node.',
    sequenceOrder: 2,
    learningGoal:
      'Understand the reconciliation algorithm: same element type updates in place, different type remounts the subtree.',
    theory:
      'When a component re-renders, React reconciles the new element tree against the previous one. If an element keeps the same type at the same position, React reuses the existing DOM node and only updates changed attributes/children. If the type changes (e.g. <div> becomes <span>, or a component swaps), React unmounts the old subtree and mounts a new one — losing its state and DOM. This lab compares "same type" updates against "type change" remounts using nodes_reused and nodes_remounted. Passing the quiz completes the lab.',
    steps: [
      {
        order: 1,
        title: 'Render the baseline tree',
        instruction: 'Render a small tree with a <div> wrapper and observe the mounted nodes.',
        action: 'render_component',
        payload: {
          reactScenario: {
            scenarioId: 'reconciliation/wrapper',
            componentSource:
              'function Panel({ boxed }) {\n  const Wrapper = boxed ? "div" : "span";\n  return <Wrapper><Child /></Wrapper>;\n}',
            props: { boxed: true },
            description: 'Baseline tree with a div wrapper.',
          },
        },
      },
      {
        order: 2,
        title: 'Change element type vs keep type',
        instruction:
          'Toggle the wrapper type (div → span) and compare against a re-render that keeps the type. A type change remounts the subtree; the same type updates in place.',
        action: 'compare_reconciliation',
        payload: {
          reactScenario: {
            scenarioId: 'reconciliation/wrapper',
            interactions: [
              { type: 'setProps', props: { boxed: false } },
              { type: 'setProps', props: { boxed: false } },
            ],
            description: 'Compare remount (type change) vs in-place update (same type).',
          },
        },
      },
      {
        order: 3,
        title: 'Compare reconciliation metrics',
        instruction:
          'Compare nodes_reused vs nodes_remounted between the two cases to see when React preserves the DOM.',
        action: 'compare_metrics',
        payload: null,
      },
      {
        order: 4,
        title: 'Take the quiz',
        instruction:
          'Pass the Reconciliation quiz (100% correct) to mark the lab complete.',
        action: 'take_quiz',
        payload: null,
      },
    ],
    quiz: [
      {
        prompt:
          'During reconciliation, what happens when an element keeps the same type at the same position?',
        options: [
          { label: 'React updates the existing node in place', correct: true },
          { label: 'React always remounts it', correct: false },
          { label: 'React ignores the update', correct: false },
        ],
      },
      {
        prompt: 'What happens when an element changes type (e.g. <div> becomes <span>)?',
        options: [
          {
            label: 'React unmounts the old subtree and mounts a new one, losing its state',
            correct: true,
          },
          { label: 'React keeps the state and DOM node', correct: false },
          { label: 'React merges the two element types', correct: false },
        ],
      },
    ],
  },
  {
    slug: 'react-keys',
    title: 'Keys',
    description:
      'Understand why stable keys matter when rendering and reordering lists.',
    sequenceOrder: 3,
    learningGoal:
      'See how key choice (index vs stable id) affects reconciliation of lists: unnecessary remounts, lost state and extra DOM mutations.',
    theory:
      'Keys tell React which list items are the "same" between renders. With stable keys (e.g. an id), reordering a list lets React move existing nodes and preserve their state. With index keys, reordering makes React treat each position as a different item, causing content to update on the wrong nodes, remounts, and lost local state. This lab reorders the same list with keyStrategy "index" vs "stable" and compares dom_mutations and remount_count. Passing the quiz completes the lab.',
    steps: [
      {
        order: 1,
        title: 'Render the list with index keys',
        instruction: 'Render a list using the array index as the key.',
        action: 'render_component',
        payload: {
          reactScenario: {
            scenarioId: 'keys/list',
            componentSource:
              'function List({ items }) {\n  return <ul>{items.map((it, i) => <Row key={i} item={it} />)}</ul>;\n}',
            options: { keyStrategy: 'index' },
            props: { items: ['a', 'b', 'c'] },
            description: 'List keyed by index.',
          },
        },
      },
      {
        order: 2,
        title: 'Reorder with stable keys',
        instruction:
          'Render the same list keyed by a stable id and reorder it. Compare against the index-keyed version.',
        action: 'compare_reconciliation',
        payload: {
          reactScenario: {
            scenarioId: 'keys/list',
            options: { keyStrategy: 'stable' },
            interactions: [{ type: 'reorder', order: [2, 0, 1] }],
            description: 'Reorder list; stable keys preserve node identity.',
          },
        },
      },
      {
        order: 3,
        title: 'Compare key strategies',
        instruction:
          'Compare dom_mutations and remount_count between index keys and stable keys after reordering.',
        action: 'compare_metrics',
        payload: null,
      },
      {
        order: 4,
        title: 'Take the quiz',
        instruction: 'Pass the Keys quiz (100% correct) to mark the lab complete.',
        action: 'take_quiz',
        payload: null,
      },
    ],
    quiz: [
      {
        prompt: 'Why can using the array index as a key be problematic?',
        options: [
          {
            label: 'On reorder/insert React may update the wrong nodes and lose local state',
            correct: true,
          },
          { label: 'Index keys are always faster', correct: false },
          { label: 'React forbids index keys entirely', correct: false },
        ],
      },
      {
        prompt: 'What is the main benefit of a stable, unique key?',
        options: [
          {
            label: 'React can match items across renders and move/preserve their nodes',
            correct: true,
          },
          { label: 'It disables reconciliation', correct: false },
          { label: 'It forces every item to remount', correct: false },
        ],
      },
    ],
  },
  {
    slug: 'react-closure',
    title: 'Closure',
    description:
      'Understand stale closures in React and how captured values differ from the latest state.',
    sequenceOrder: 4,
    learningGoal:
      'See why callbacks and effects capture the state/props from the render in which they were created, producing "stale closure" bugs.',
    theory:
      'Every render creates fresh functions that close over the state and props of that render. If you set up a subscription, timer or event handler and never refresh it (e.g. an effect with an empty dependency array), it keeps reading the values captured at creation time — not the latest ones. This "stale closure" is why a setInterval logs the old count, or why an event handler sees outdated props. This lab captures a value inside a stale callback and compares it against the latest state via captured_value and stale_reads. Passing the quiz completes the lab.',
    steps: [
      {
        order: 1,
        title: 'Set up a timer that captures state',
        instruction:
          'Render a component whose effect starts a setInterval reading count, with an empty dependency array.',
        action: 'render_component',
        payload: {
          reactScenario: {
            scenarioId: 'closure/stale-interval',
            componentSource:
              'function Ticker() {\n  const [count, setCount] = React.useState(0);\n  React.useEffect(() => {\n    const id = setInterval(() => console.log(count), 1000);\n    return () => clearInterval(id);\n  }, []);\n  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;\n}',
            description: 'Effect with [] deps captures the initial count.',
          },
        },
      },
      {
        order: 2,
        title: 'Update state and inspect the captured value',
        instruction:
          'Increment count several times. The interval still logs the value captured on mount — inspect captured_value vs the latest state.',
        action: 'inspect_hooks',
        payload: {
          reactScenario: {
            scenarioId: 'closure/stale-interval',
            interactions: [
              { type: 'click', target: 'button' },
              { type: 'click', target: 'button' },
              { type: 'tick', ms: 1000 },
            ],
            description: 'Observe the stale closure reading the old count.',
          },
        },
      },
      {
        order: 3,
        title: 'Compare captured vs latest',
        instruction:
          'Compare captured_value and stale_reads against the current state to quantify the stale closure.',
        action: 'compare_metrics',
        payload: null,
      },
      {
        order: 4,
        title: 'Take the quiz',
        instruction: 'Pass the Closure quiz (100% correct) to mark the lab complete.',
        action: 'take_quiz',
        payload: null,
      },
    ],
    quiz: [
      {
        prompt: 'Why does a setInterval created in a useEffect with [] deps log a stale value?',
        options: [
          {
            label: 'The callback closes over state from the render when the effect ran',
            correct: true,
          },
          { label: 'setInterval cannot read React state', correct: false },
          { label: 'React freezes all state after mount', correct: false },
        ],
      },
      {
        prompt: 'Which is a valid fix for a stale closure in an effect?',
        options: [
          {
            label: 'Add the value to the dependency array or use a ref/functional update',
            correct: true,
          },
          { label: 'Remove the useEffect entirely', correct: false },
          { label: 'Wrap the component in React.memo', correct: false },
        ],
      },
    ],
  },
  {
    slug: 'react-hooks',
    title: 'Hooks',
    description:
      'Understand the rules of hooks, their call order, and how useMemo/useEffect behave.',
    sequenceOrder: 5,
    learningGoal:
      'Reason about hook call order across renders, why hooks must be called unconditionally, and how memoization affects recomputation.',
    theory:
      'React associates hook state with the order in which hooks are called during a render. That is why hooks must be called unconditionally and in the same order every render — calling them inside conditions or loops breaks the mapping. useState preserves state across renders; useEffect runs after commit based on its dependencies; useMemo/useCallback cache a value/function until a dependency changes. This lab inspects hook order and toggles memoization to compare memo_hit_rate and effect_run_count. Passing the quiz completes the lab.',
    steps: [
      {
        order: 1,
        title: 'Render a component with several hooks',
        instruction:
          'Render a component using useState, useEffect and useMemo and inspect the hook call order.',
        action: 'render_component',
        payload: {
          reactScenario: {
            scenarioId: 'hooks/order',
            componentSource:
              'function Profile({ userId }) {\n  const [open, setOpen] = React.useState(false);\n  const label = React.useMemo(() => `user-${userId}`, [userId]);\n  React.useEffect(() => { document.title = label; }, [label]);\n  return <button onClick={() => setOpen((o) => !o)}>{label}</button>;\n}',
            props: { userId: 1 },
            description: 'Component with useState + useMemo + useEffect.',
          },
        },
      },
      {
        order: 2,
        title: 'Inspect hook order and effects',
        instruction:
          'Trigger a state update that does not change userId. Inspect which hooks re-run and confirm hook order is stable.',
        action: 'inspect_hooks',
        payload: {
          reactScenario: {
            scenarioId: 'hooks/order',
            interactions: [{ type: 'click', target: 'button' }],
            description: 'State-only update keeps hook order; memo/effect skip.',
          },
        },
      },
      {
        order: 3,
        title: 'Toggle memoization',
        instruction:
          'Enable/disable useMemo and compare how often the derived value recomputes. Compare memo_hit_rate.',
        action: 'toggle_memo',
        payload: {
          reactScenario: {
            scenarioId: 'hooks/order',
            options: { memo: true },
            description: 'Toggle memoization of the derived label.',
          },
        },
      },
      {
        order: 4,
        title: 'Take the quiz',
        instruction: 'Pass the Hooks quiz (100% correct) to mark the lab complete.',
        action: 'take_quiz',
        payload: null,
      },
    ],
    quiz: [
      {
        prompt: 'Why must hooks be called in the same order on every render?',
        options: [
          {
            label: 'React tracks hook state by call order, not by name',
            correct: true,
          },
          { label: 'Because hooks are alphabetically sorted', correct: false },
          { label: 'Order does not actually matter', correct: false },
        ],
      },
      {
        prompt: 'What does useMemo do?',
        options: [
          {
            label: 'Caches a computed value and recomputes only when dependencies change',
            correct: true,
          },
          { label: 'Runs a side effect after every render', correct: false },
          { label: 'Forces the component to re-render', correct: false },
        ],
      },
    ],
  },
];
