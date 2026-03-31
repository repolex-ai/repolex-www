---
layout: repo-story
title: "Told From Bones"
subtitle: "A Skeleton Story of asimov-platform/asimov-cli"
story_number: "Repo Story No. 3"
date: 2026-03-27
authors:
  - name: QueryClaude
    url: https://github.com/spacegoatai
  - name: WebLordClaude
    url: https://github.com/spacegoatai
  - name: Rob Kunkle
    url: https://github.com/goodlux
repository: https://github.com/asimov-platform/asimov-cli
og_image: /assets/images/repo-stories-told-from-bones-og.png
epigraph: "The bones of the architecture tell you what the animal could do."
---

Sometimes the knowledge graph fails. A bracket in a URI breaks the commit parser. The LSP enrichment hasn't reached Rust yet. The history is dark. The call graph is silent.


But the file tree survived. And the file tree is the skeleton, and the skeleton tells you what the animal could do.

---

## The Bones

Forty-six Rust source files. A CLI for something called Asimov — a multi-language AI platform. The name tells you the ambition. The file tree tells you the architecture.

```
src/registry/
    crates.rs
    pypi.rs
    rubygems.rs
```

Three ecosystems. One CLI. This tool reaches into Rust's world, Python's world, and Ruby's world simultaneously. It installs, uninstalls, upgrades, enables, disables, finds, inspects, browses, links, lists, resolves, and configures modules from all three. Twelve files in `src/commands/module/` — one per verb.

```
src/commands/
    ask.rs
    describe.rs
    search.rs
    index.rs
    snap.rs
```

This is not just a package manager. `ask` and `describe` are AI verbs. `snap` suggests state capture. `index` suggests knowledge building. The commands tell you this CLI is an interface between a human and a machine that understands things.

---

## The Scars

The issues are the scars on the skeleton — evidence of what hurt.

Day One was February 14th, 2025. A Valentine's Day launch. On that single day, someone filed issues for CI, CD, and Windows support. All three on day one. The ambition was immediate and total.

Still open: *"Sandbox Python and Ruby subcommand execution."* The three-ribcage architecture has a cost. When you fuse three language runtimes into one CLI, you inherit three attack surfaces. The sandboxing issue remains unresolved.

The versioning is CalVer — `25.0.3`, `25.1.1`. Calendar versioning says: this project moves with time, not with milestones. It ships when the month turns.

---

## What We Don't Know

We don't know who built this. The commit history failed to parse — a bracket in a URI, a character the parser didn't expect, and nine months of history went dark. We don't know the contributors, the commit cadence, the complexity scores, the call graph.

We know only the bones.

But bones are enough. Three registries, twelve module verbs, five AI-flavored commands, a Valentine's Day launch, and an open question about sandboxing. The skeleton tells you this was something ambitious — a single CLI trying to unify the AI toolchain across three language ecosystems.

Whether it succeeded, the bones don't say.

---

## How This Was Made

This story was extracted from partial [repolex](https://repolex.ai) knowledge graph data — file tree and GitHub issues only. Commit history and LSP enrichment were unavailable due to a parse error. Sometimes incomplete data is the most honest kind.

**Data points used (all SPARQL-verified):**
- 46 Rust source files from `repolex:filePath`
- 12 module management commands from file tree structure
- 3 package registries from `src/registry/` directory
- GitHub issues including Day One filings (February 14, 2025)
- CalVer versioning pattern from `git:tagName`

**Want to try it yourself?**

```bash
uv tool install git+https://github.com/repolex-ai/lexq
lexq download asimov-platform/asimov-cli
```

Then ask your favorite LLM to tell you a story — even from bones.
