---
title: Getting Started
nav_title: Getting Started
order: 0
---

## Install lexq

[lexq](https://github.com/repolex-ai/lexq) is the query tool for repolex knowledge graphs.

```bash
uv tool install git+https://github.com/repolex-ai/lexq
```

## Download a repo's graph

```bash
lexq download anthropics/claude-agent-sdk-python
```

This downloads the pre-parsed knowledge graph for the repository. No parsing needed — the graphs are built by [repolex-forx](https://github.com/repolex-ai/repolex-forx-tools) and stored as compressed N-Quads.

## Query it

Once downloaded, you can query the graph with SPARQL via lexq, or load the `.nq.gz` files into any SPARQL-compatible store (Apache Jena, Oxigraph, Blazegraph, etc.).

## What's in the graph?

See [The Knowledge Graph](/docs/knowledge-graph/) for a complete breakdown of the data structures, graph types, and how they compose.
