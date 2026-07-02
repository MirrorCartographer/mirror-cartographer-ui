# Governance Graph Query Interface Design Pattern

Date: 2026-07-02
Status: proposed design pattern
Scope: public-safe MC architecture governance substrate

## Architecture question

How should MC define a canonical graph query interface — selectors, traversal rules, and stable node/edge semantics — so future tools such as CI, visualization, provenance analysis, roadmap generation, and documentation can consume the same governance graph without inventing incompatible interpretations?

## Research basis

Current sources suggest four useful patterns:

1. JSONPath, standardized in RFC 9535, treats a query as a selector over a JSON value that returns a nodelist. It also separates query well-formedness and validity errors from ordinary data mismatches. Useful MC concept: graph queries should return stable result sets and distinguish invalid selector syntax from zero-result queries.
2. GraphQL selection sets require clients to declare the fields they want, and nested fields define the shape of the response. Useful MC concept: query output should be projection-based, not an uncontrolled dump of the graph.
3. SPARQL 1.1 property paths add compact path-matching over graph relationships. Useful MC concept: MC needs bounded traversal over typed edges such as `supersedes`, `derived_from`, `validated_against`, `compatible_with`, `generated_by`, and `uses_fixture`.
4. ISO/IEC 39075:2024 GQL formalizes property-graph querying, creation, modification, and control. Useful MC concept: MC should model governance artifacts as property-graph-like nodes and typed edges, but should not adopt a full database language for the first implementation.

## Change in understanding

The deterministic `governance.graph.v1.json` index is not enough by itself. Without a shared query contract, every downstream tool will silently reinterpret graph semantics.

The architectural correction is to introduce a narrow interface:

- The graph index remains the generated source artifact.
- Query behavior is defined by a small selector language, not by ad hoc JavaScript filters.
- Query results are deterministic JSON records.
- Traversal semantics are bounded, typed, and acyclic-aware.
- CI, visualization, roadmap generation, and documentation use the same selectors.

This shifts MC from:

```text
consumer loads graph -> custom interpretation -> fragile output
```

to:

```text
consumer selector -> canonical query engine -> deterministic result envelope
```

## Non-goals

The first interface must not become:

- a general database,
- a SPARQL implementation,
- a GraphQL server,
- a GQL/Cypher clone,
- a mutable graph API,
- a runtime application dependency.

It is a read-only governance graph query contract.

## Proposed artifact: `governance.graph.query.v1`

### Query envelope

A query is a JSON object:

```json
{
  "query_version": "governance.graph.query.v1",
  "select": ["artifact_id", "artifact_type", "version", "path"],
  "from": "nodes",
  "where": {
    "artifact_type": "schema"
  },
  "traverse": [],
  "order_by": ["artifact_id", "version"],
  "limit": 100
}
```

### Required fields

- `query_version`: fixed string for the contract version.
- `from`: either `nodes` or `edges`.
- `select`: ordered projection list.

### Optional fields

- `where`: exact-match filters over stable node or edge properties.
- `traverse`: ordered traversal steps.
- `order_by`: deterministic ordering keys.
- `limit`: maximum results returned.

## Selector rules

1. Unknown selected fields are query errors, not empty results.
2. Unknown filter fields are query errors.
3. Unsupported edge types are query errors.
4. A valid selector that matches nothing returns an empty `results` array with status `ok`.
5. Result ordering is deterministic. If no `order_by` is supplied, default ordering is by `artifact_id`, then `version`, then `edge_type`, then `target_artifact_id` where applicable.
6. Selectors must be read-only.
7. Selectors must not execute user code.
8. Selectors must not read the filesystem directly; they operate only on the already-generated graph JSON.

## Traversal rules

A traversal step has this shape:

```json
{
  "edge_type": "supersedes",
  "direction": "out",
  "max_depth": 3
}
```

Allowed `direction` values:

- `out`: from source artifact to target artifact.
- `in`: from target artifact back to source artifact.
- `both`: both directions, only for explicit inspection queries.

Rules:

1. `max_depth` is required and must be finite.
2. `max_depth` greater than 10 is rejected in v1.
3. Traversal records visited node IDs to avoid repeated output.
4. Encountering a cycle in graph metadata is not a traversal success; the graph generator should already reject cycles. If encountered anyway, the query engine returns a structured `GRAPH/CYCLE_DETECTED` error.
5. Multi-step traversal is evaluated in listed order.

## Result envelope

Every query returns this shape:

```json
{
  "query_version": "governance.graph.query.v1",
  "status": "ok",
  "errors": [],
  "summary": {
    "input_node_count": 0,
    "input_edge_count": 0,
    "result_count": 0
  },
  "results": []
}
```

Error result:

```json
{
  "query_version": "governance.graph.query.v1",
  "status": "error",
  "errors": [
    {
      "code": "QUERY/UNKNOWN_FIELD",
      "message": "Selector requested an unknown field.",
      "field": "example"
    }
  ],
  "summary": {
    "input_node_count": 0,
    "input_edge_count": 0,
    "result_count": 0
  },
  "results": []
}
```

## Initial stable error-code namespace

- `QUERY/INVALID_VERSION`
- `QUERY/INVALID_FROM`
- `QUERY/UNKNOWN_FIELD`
- `QUERY/UNKNOWN_EDGE_TYPE`
- `QUERY/INVALID_DIRECTION`
- `QUERY/MAX_DEPTH_EXCEEDED`
- `QUERY/LIMIT_EXCEEDED`
- `GRAPH/CYCLE_DETECTED`
- `GRAPH/MISSING_NODE`
- `GRAPH/MALFORMED_INDEX`

## Initial canonical queries

### List all schemas

```json
{
  "query_version": "governance.graph.query.v1",
  "from": "nodes",
  "select": ["artifact_id", "version", "path"],
  "where": { "artifact_type": "schema" },
  "order_by": ["artifact_id", "version"]
}
```

### Find what validates a report schema

```json
{
  "query_version": "governance.graph.query.v1",
  "from": "nodes",
  "select": ["artifact_id", "artifact_type", "version", "path"],
  "where": { "artifact_id": "lockfile-provenance-report" },
  "traverse": [
    { "edge_type": "validated_against", "direction": "out", "max_depth": 1 }
  ],
  "order_by": ["artifact_id", "version"]
}
```

### Find lineage ancestors

```json
{
  "query_version": "governance.graph.query.v1",
  "from": "nodes",
  "select": ["artifact_id", "version", "path"],
  "where": { "artifact_id": "artifact.manifest" },
  "traverse": [
    { "edge_type": "supersedes", "direction": "out", "max_depth": 10 }
  ],
  "order_by": ["artifact_id", "version"]
}
```

### Find disconnected artifacts

This should be a built-in named query rather than a generic selector in v1:

```json
{
  "query_version": "governance.graph.query.v1",
  "from": "nodes",
  "select": ["artifact_id", "artifact_type", "version", "path"],
  "where": { "graph_state": "disconnected" },
  "order_by": ["artifact_type", "artifact_id", "version"]
}
```

Implementation note: `graph_state` is derived by the query engine from graph topology; it is not a manifest field.

## Requirements update

1. Add `mind/schemas/governance.graph.query.v1.schema.json` before implementing the query engine.
2. Add query fixtures for:
   - valid empty result,
   - unknown field error,
   - unknown edge type error,
   - bounded traversal result,
   - disconnected artifact query,
   - deterministic ordering.
3. Implement `scripts/query-governance-graph.mjs` as a dependency-free read-only script.
4. The script accepts:
   - `--graph <path>`
   - `--query <path>`
   - `--out <path>` optional
5. The script exits:
   - `0` for valid query execution, including empty results,
   - non-zero for invalid selector, malformed graph, or traversal integrity failure.
6. CI should run canonical query fixtures after graph generation and before visualization or documentation generation.

## Design pattern

Name: Canonical Read-Only Graph Selector

Intent: prevent tool-specific graph interpretation drift.

Forces:

- The graph must be useful to multiple consumers.
- Consumers need predictable output shapes.
- The first implementation should remain dependency-free.
- Governance tooling should not mutate artifacts.
- Traversal must be expressive enough for lineage and compatibility, but bounded enough for CI.

Resolution:

Define a small JSON query envelope with exact-match filters, projection, deterministic ordering, and bounded typed-edge traversal. Make all consumers call this interface instead of directly interpreting graph JSON.

## Public-safety note

This artifact contains only abstract governance architecture. It does not include private user material, personal symbolic content, or non-public decision records.

## Next architecture question

How should MC define `governance.graph.query.v1.schema.json` and the first fixture corpus so query compatibility can be tested the same way report compatibility is tested — with schema validation, deterministic outputs, stable error codes, and historical fixture replay?
