---
layout: post
title: "Tentacles and Plexuses: Anatomy of a Semantic System"
date: 2025-11-02
---

Repolex uses a biological metaphor for its architecture. Let me explain why we talk about tentacles, plexuses, and corpus.

## Tentacles: Tool Wrappers

A **tentacle** wraps a Python library with a semantic ontology. For example, the DocstringParser tentacle:

```python
class DocstringParserTentacle(Tentacle):
    def parse(self, text: str) -> Docstring:
        # Returns OwlReady2 instance, not dict
        doc = self.Ontology.Docstring(uri)
        doc.shortDescription = parsed.short_description
        return doc
```

The key insight: return semantic objects, not plain data structures. Every tentacle contributes vocabulary to the knowledge graph.

## Plexuses: Domain Orchestrators

A **plexus** coordinates tentacles to parse a specific domain. The RepoPlexus uses Git, AST, and Docstring tentacles together:

```python
# Parse file with AST tentacle
ast_tree = self.tentacles["ast"].parse(file_path)

# Parse docstring with DSP tentacle
doc = self.tentacles["dsp"].parse(docstring_text)

# Connect them
func.hasDocstring = [doc]
```

Plexuses define *relationships* between tentacle outputs. They're the glue.

## Corpus: Central Nervous System

The **corpus** holds all ontologies and system metadata. It's the single source of truth. Every plexus references the corpus. Every tentacle registers its ontology with the corpus.

Think of it as the brain coordinating all the tentacles.

## Why This Metaphor?

Because the system *grows*. We have a TentacleMaker that generates new tentacles by introspecting Python libraries. The system literally grows new capabilities on demand.

It's not just a metaphor. It's how we think about extensibility.

More on auto-generating tentacles in a future post.
