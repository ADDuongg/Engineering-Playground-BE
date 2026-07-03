# DOMAIN

## Track

A Track is the highest-level learning domain on the platform.

Examples:

- Database / SQL
- React Rendering
- System Design
- Redis
- Kafka
- Browser Performance

Each Track defines:

- **Runtime Adapter** — how experiments execute (PostgreSQL, Redis, headless React, simulation, etc.)
- **Input Surface** — how users interact (SQL editor, config form, sandbox, diagram builder)
- **Metric Catalog** — which metrics this Track exposes
- **Visualization Kit** — which chart types render those metrics

Tracks are independently extensible. Adding a new Track MUST NOT change the experiment lifecycle.

---

## Category

A Category groups related Labs within a Track.

Examples:

- Database Track: indexes, execution plans, pagination
- React Rendering Track: memoization, virtualization, profiler
- System Design Track: load balancing, caching, consistency

Each Category belongs to exactly one Track.

---

## Lab

A Lab is the smallest learning unit.

Each Lab belongs to exactly one Track and one Category.

Each Lab must have:

- learning goal
- experiment
- visualization
- quiz

Each Lab may have (depending on Track):

- dataset (Database Track)
- benchmark (Database, Redis, Load Testing Tracks)
- configuration panel (React Rendering, System Design Tracks)

Every Lab should teach exactly one engineering concept.

---

## Experiment

Each experiment follows the same lifecycle regardless of Track:

input

↓

runner (Runtime Adapter)

↓

metrics

↓

visualization

The **runner** is Track-specific:

- Database Track → SQL execution against Playground PostgreSQL
- Redis Track → cache operations against Playground Redis
- React Rendering Track → component render profiling in sandbox
- System Design Track → simulation engine

---

## Runtime Adapter

A Runtime Adapter executes experiments for a specific Track.

Rules:

- Runtime Adapters are infrastructure — application code MUST NOT depend on implementation details
- Each Track declares which Runtime Adapter it uses
- Not every Track uses Playground PostgreSQL (e.g. React Rendering, System Design use different runtimes)
- Runtime state is disposable and resettable per experiment

Examples:

| Track | Runtime Adapter |
|-------|----------------|
| Database / SQL | Playground PostgreSQL |
| Redis | Playground Redis |
| React Rendering | Headless React sandbox |
| System Design | Simulation engine |
| Kafka | Playground Kafka |

---

## Metric Contract

All metrics follow a shared contract regardless of Track:

```
{
  key: string        // e.g. "execution_time", "render_count"
  label: string     // human-readable name
  unit: string       // e.g. "ms", "rows", "count"
  value: number     // measured value
  group: string     // e.g. "performance", "scan", "cache", "render"
}
```

Each Track declares its own **Metric Catalog** — the set of metrics it produces.

Examples:

**Database Track metrics:**

- Execution Time (ms)
- Rows Scanned
- Rows Returned
- Index Used
- Scan Type
- Buffer Hits

**React Rendering Track metrics:**

- Render Count
- Commit Duration (ms)
- Component Tree Depth
- Memo Hit Rate

**System Design Track metrics:**

- Request Latency (ms)
- Throughput (RPS)
- Error Rate
- Cache Hit Ratio

Frontend MUST NOT compute engineering metrics. All metrics originate from Backend.

---

## Visualization

Every visualization must be generated from Metrics.

Never compute metrics inside React.

Metrics always come from Backend.

Each Track provides a **Visualization Kit** — the set of chart types available for its metrics (tree, bar, line, flame graph, architecture diagram, etc.).
