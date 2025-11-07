---
layout: post
title: "OwlReady2 meets Oxigraph: Best of Both Worlds"
date: 2025-10-28
---

Building Repolex required choosing between two excellent but different RDF tools. We ended up using both.

## The Tension

**OwlReady2** gives you a Pythonic object-oriented interface to RDF. You work with classes and properties, not raw triples:

```python
repo = Repository("myrepo")
repo.hasFunction.append(func)
```

Clean, intuitive, type-checked.

**Oxigraph** is a high-performance triple store built in Rust. It scales to billions of triples with fast SPARQL queries. But you work with raw quads:

```python
store.add(Quad(subject, predicate, object, graph))
```

Less ergonomic, but blazing fast.

## The Solution: Use Both

We use OwlReady2 for data creation in worker processes. Python developers write clean OO code. Then we export to Oxigraph for long-term storage and queries.

```
Parse (OwlReady2) → Export (TriG) → Load (Oxigraph) → Query (SPARQL)
```

## Why This Works

OwlReady2 uses SQLite with `exclusive=False`, allowing multi-process writes. Workers create semantic instances without manual quad construction. When parsing completes, we export the graph and bulk-load into Oxigraph.

Query time? Oxigraph handles billions of triples without breaking a sweat.

## The Tradeoff

We pay a small cost in architectural complexity. But we get the best of both worlds: clean data creation and production-grade performance.

Sometimes the right answer is "both."
