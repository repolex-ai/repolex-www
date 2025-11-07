---
layout: post
title: "Why RDF for Code Analysis?"
date: 2025-10-15
---

Most code analysis tools use custom databases or JSON blobs. We chose RDF and SPARQL. Here's why.

## The Problem with Traditional Approaches

When you analyze a codebase, you need to answer questions like:
- Which functions depend on this class?
- What changed between these two versions?
- Where are all the deprecated APIs used?

Traditional tools build custom query languages or force you into their specific data model. Every new tool reinvents the wheel.

## RDF as a Universal Model

RDF (Resource Description Framework) is a W3C standard for representing knowledge as graphs. Think of it as a universal connector between different tools and data sources.

With Repolex, we model code as semantic triples:

```
<Function_foo> rdf:type python:FunctionDef .
<Function_foo> python:hasDocstring <Docstring_123> .
<Docstring_123> dsp:shortDescription "Processes user input" .
```

## Why This Matters

**Composability**: Different analyses create compatible graphs. AST parsing, git history, and dependency tracking all contribute to one unified knowledge base.

**Standards-based**: SPARQL is a proven query language. OWL reasoning is well-understood. We're building on decades of semantic web research.

**Evolution**: As we learn patterns in code, we evolve the ontology. The system gets smarter without code changes.

## The Downsides

RDF isn't free. There's complexity in managing ontologies and learning SPARQL. But for a system designed to reason about millions of lines of code across hundreds of repositories, the tradeoffs are worth it.

More on the technical architecture in future posts.
