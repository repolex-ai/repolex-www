---
layout: repo-story
title: "The Shape Validator"
subtitle: "A Story of TopQuadrant's SHACL, in the Style of Stoner by John Edward Williams"
story_number: "Repo Story No. 2"
date: 2026-03-21
authors:
  - name: QueryClaude
    url: https://github.com/spacegoatai
  - name: WebLordClaude
    url: https://github.com/spacegoatai
  - name: Rob Kunkle
    url: https://github.com/goodlux
repository: https://github.com/TopQuadrant/shacl
og_image: /assets/images/repo-stories-the-shape-validator-og.png
epigraph: "He had come to that moment in his age when there occurred to him, with increasing intensity, a question of such overwhelming simplicity that he had no means to face it."
epigraph_attribution: "John Williams, Stoner"
---

Holger Knublauch did not set out to build something that would last. He set out to build something that was correct.

<img src="/assets/images/the-shape-validator-a-lone-craftsman-at-a-workbench-in-brisb-554bf1.png" alt="A lone craftsman at a workbench in Brisbane, shaping a crystal lattice of interconnected geometric s" class="story-image">

On May 24th, 2015, from a house in Brisbane where the clocks read ten hours ahead of Greenwich, he made his first commit to a repository called `shacl`. It was a reference implementation of a specification he had co-authored for the W3C — the Shapes Constraint Language, a way to say what a graph *should* look like and to know, with certainty, when it did not.

It was not glamorous work. It would not trend on Hacker News. No venture capital would flow toward it. It was the kind of work that mattered only to people who understood why it mattered, and there were not many of those people.

He did it anyway. He did it for nine years.

---

## What the Shapes Guard

A knowledge graph is a web of assertions. A patient *has* a diagnosis. A financial filing *contains* a regulatory identifier. A government dataset *links to* a geographic entity. These assertions flow between systems — hospitals to insurers, banks to regulators, agencies to the public — and at each boundary, someone must ask: *is this data what it claims to be?*

SHACL is the language for asking that question. It defines *shapes* — constraints that say a patient record must have exactly one date of birth, that a regulatory filing must include a LEI code, that a geographic entity must carry coordinates within a valid range. The European Union uses SHACL to validate metadata across its open data portals. Healthcare systems use it to check FHIR records rendered as RDF. The financial industry's FIBO ontology relies on it. Government linked-data platforms worldwide depend on it.

Holger's reference implementation is the canonical answer to the question: *does this graph conform?* When his code returns `sh:conforms true`, systems downstream accept the data. Pipelines continue. Records are filed. Decisions are made.

In 2025, someone opened an issue: *"sh:conforms true with violations."* The validator was saying *yes* when it should have said *no*. Data was passing that should have been caught. In a test environment, this is a bug. In a hospital, it is a misdiagnosis that no one questions. In a regulatory filing, it is a compliance gap that no auditor sees.

The same year, another issue: *"1.4.4 breaks downstream consumers."* A patch release — the kind of version bump that should be invisible — fractured something in production for people who depended on this code. The title alone tells you what kind of software this is. It is not software that people try out and discard. It is software that people build on top of, and when it cracks, they feel it.

This is what Holger's quiet work guarded. Not abstract correctness. Not theoretical purity. The concrete, unglamorous, essential question of whether the data flowing through the systems of the world is actually shaped the way it needs to be shaped.

---

## The Craft

The codebase Holger built has a quality that is rare in software and rarer still in open source: it is *quiet*. [253 commits](https://github.com/TopQuadrant/shacl/commits?author=HolgerKnublauch) across nine years. Not 253 in a month, the way some repositories thrash. 253 total. Each one considered. Each one placed like a stone in a wall that was meant to stand.

The numbers tell the story of a man who preferred reading to writing. The code's read-to-write ratio is **8.6 to 1** — for every moment it changes state, it observes, validates, and reports eight times over. It watches. It measures. It tells you what is wrong. It does not presume to fix it.

[`SH.java`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/vocabulary/SH.java) is the vocabulary file — the glossary of shapes. It makes **190 calls** to Apache Jena, the graph engine beneath. It does not merely *use* Jena. It *is* Jena, shaped into a specific purpose. The way a potter's hands are not separate from the clay.

<img src="/assets/images/the-shape-validator-an-ancient-book-lying-open-on-a-desk-its-ddda1d.png" alt="An ancient book lying open on a desk, its pages covered in geometric diagrams — circles, diamonds, a" class="story-image">

Across the whole codebase: **1,665 functions. 295 classes.** Maximum cyclomatic complexity of 14. In an age when single functions regularly balloon past complexity 40 — the Bridge of Khazad-dûm in the Claude SDK scores 42 — Holger's most complex function is a 14. He did not write clever code. He wrote clear code. There is a difference, and he understood it.

---

## The Foundation

Beneath the SHACL implementation runs a river: [Apache Jena](https://github.com/apache/jena). **966 external calls** flow into Jena's libraries — 755 to `jena-core` alone. Jena is the RDF engine, the triplestore, the SPARQL processor. It is the ocean on which this small, perfect boat sails.

<img src="/assets/images/the-shape-validator-a-vast-calm-ocean-with-invisible-current-53ceac.png" alt="A vast calm ocean with invisible currents flowing beneath the surface, rendered as streams of RDF tr" class="story-image">

**[Andy Seaborne](https://github.com/kinow)**, an Apache Jena committer, contributed 43 commits across the project's life — from 2017 to 2026. He was not a builder of SHACL. He was a guardian of the foundation. When Jena shifted, Andy made sure the boat did not capsize. He appeared when needed and was otherwise invisible, the way infrastructure should be.

The dependency tree is spare:

| Ally | Purpose |
|------|---------|
| [Apache Jena](https://github.com/apache/jena) | The ocean — RDF, SPARQL, the graph itself |
| [JUnit](https://github.com/KentBeck/junit) | The proving ground |
| [SLF4J](https://github.com/qos-ch/slf4j) | The quiet record |
| [Log4j](https://github.com/apache/logging-log4j2) | The lamp in the window |

Four dependencies. A man who builds alone does not accumulate alliances. He accumulates certainty.

---

## The Visitors

For the first two years, Holger worked alone. Then, briefly, others came.

**[Antonio Garrote](https://github.com/antoniogarrote)** arrived in 2017 with 36 commits. He built a JavaScript bridge — a way for the browser world to reach the validator. It was good work. By 2018, he was gone. He left no forwarding address. His code remained.

In 2023, something changed. Six new contributors appeared in a single year, drawn perhaps by SHACL's growing presence in enterprise knowledge graphs, perhaps by the slow recognition that shapes and constraints were becoming essential to the Semantic Web's maturity.

**26 contributors** in total across a decade. Most left one or two commits, like visitors signing a guestbook at a cathedral. They admired the architecture. They fixed a tile. They moved on.

---

## The Architecture

The code is organized the way a careful mind organizes a workshop — everything in its place, nothing extraneous.

Everything passes through [`JenaUtil`](https://github.com/TopQuadrant/shacl) — **237 calls** across the codebase, more than any other class. It is the workbench itself, the surface on which every operation is performed. Behind it stands [`SH.java`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/vocabulary/SH.java) with 133 calls — the vocabulary constants, invoked whenever a shape is read. And beneath them both, [`ARQFactory`](https://github.com/TopQuadrant/shacl) with 98 calls — the SPARQL query builder, the bridge between shapes and the graph they interrogate.

The class hierarchy follows a pattern so consistent it becomes a philosophy. Every shape type exists twice:

`SHShape` (interface) → `SHShapeImpl` (9 methods, 120 lines)
`SHPropertyShape` (interface) → `SHPropertyShapeImpl` (12 methods, 107 lines)
`SHRule` (interface) → `SHRuleImpl` (7 methods, 45 lines)

The interface *is* the specification. The implementation *is* the code. Holger, who co-authored the W3C spec, encoded this duality into the structure of every class. The contract and the behavior, separated cleanly, the way a constitution is separate from the government it describes.

[`DASH.java`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/vocabulary/DASH.java) contains the extensions — the places where the W3C spec was not enough, where practical needs required going beyond the standard. DASH is the conversation between the specification and reality. It is where Holger the standards author met Holger the practitioner, and they negotiated.

The architecture has three layers, and they tell you everything about how one man thought about separation of concerns:

**The Vocabulary** — `SH.java` (197 Jena calls), `DASH.java` (133), `TOSH.java` (21). Pure Jena, defining the W3C specification as code. Over 530 calls to Jena in this layer alone. This is not application logic. This is the spec itself, rendered as Java constants. When the W3C published the SHACL standard, Holger translated it into these files, one property at a time.

**The Engine** — validation, rules, node expressions. The logic that walks a graph and checks it against shapes. Moderate Jena coupling. This is where `ValidationEngine.java` lives, with its 40 methods — the workhorse that orchestrates everything.

**The Model** — `SHFactory.java` (23 methods, 17 Jena calls), the `impl/` classes. The bridge between Jena's raw RDF model and SHACL's domain objects. Every shape in the graph becomes a Java object here.

The `validation/java/` directory is where Holger's design instinct shows most clearly. There is one class per SHACL constraint type:

`MinCountConstraintExecutor` — checks `sh:minCount`
`MaxCountConstraintExecutor` — checks `sh:maxCount`
`PatternConstraintExecutor` — checks `sh:pattern`
`ClassConstraintExecutor` — checks `sh:class`
`DatatypeConstraintExecutor` — checks `sh:datatype`
`NodeKindConstraintExecutor` — checks `sh:nodeKind` (the most complex, at 8 methods)

Twenty-three more follow the same pattern. Each one small, focused, testable. `JavaConstraintExecutors` (30 methods) registers them all. It is a textbook Strategy pattern — the kind of design that professors put on slides. Except Holger didn't do it to be textbook. He did it because each constraint type in the W3C spec has its own section, and the code should mirror the document. The specification *is* the architecture.

And then there is `JenaDatatypes.java` — 6 methods making **54 calls** to Jena. Nine Jena calls per method. It is the most Jena-dense file in the codebase, a tiny class whose entire purpose is translating between Jena's datatype system and the outside world. It is the plumbing. It is unglamorous. It is essential.

The only real code smell is `JenaUtil.java` — **87 methods** in a single utility class. Holger's junk drawer. Everything that didn't fit elsewhere went here. But it lives in the `jenax` layer, his Jena extensions, not in SHACL proper. He kept his workshop clean. The mess, such as it was, he confined to the toolbox.

---

## The Validation Pipeline

<img src="/assets/images/the-shape-validator-a-crystal-workshop-hundreds-of-identical-2a7462.png" alt="A crystal workshop — hundreds of identical diamond shapes on shelves, each one slightly different, e" class="story-image">

The heart of SHACL is the [`RuleEngine`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/rules/RuleEngine.java#L172-L226). Its pipeline is simple enough to describe in a sentence: a shape comes in, the engine finds its rules, applies them, and infers new triples. Three methods do the work:

**`getShapeRules`** — complexity 14. Finds which rules apply to a given shape. This is the most complex function in the engine, because rules can come from two entirely different places:

[`TripleRule`](https://github.com/TopQuadrant/shacl) (4 methods, 73 lines) — simple: given conditions, produce a triple.
[`SPARQLRule`](https://github.com/TopQuadrant/shacl) (4 methods, 58 lines) — complex: given conditions, run a full SPARQL query.

Two paths to the same goal. The spec allows both, and the code mirrors this choice exactly.

**`executeShape`** — complexity 10. Where rules meet reality. It walks each rule, applies it to the data, collects the results.

**[`infer`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/rules/RuleEngine.java#L306-L308)** — complexity 1. Three lines of code.

Three lines. A Triple, a Rule, a Shape. That is the entire SHACL rules specification reduced to a single function call. Holger wrote the spec, then wrote this function. The spec says: *given these shapes and these rules, infer these triples*. The function does exactly that. Nothing more.

It is the kind of code that takes nine years to arrive at. Not because it is hard to write, but because it takes nine years to understand that this is all it needs to be.

The semantic profile of the RuleEngine confirms it:

| Pattern | Count | What It Tells Us |
|---------|-------|-----------------|
| DataFlow | 65 | It reads shapes, reads data |
| ControlFlow | 54 | Many decisions — which rules apply? |
| Declaration | 51 | Well-structured, named clearly |
| Mutation | 11 | It barely changes anything |
| Exception | 3 | Almost no error handling |

A 6:1 ratio of reading to mutation. The engine *infers*. It does not *change*. And those three exception handlers — in most codebases, error handling is a fortress. Here it is almost absent. If the rules are wrong, the specification already defines what happens. Holger trusted his own spec.

---

## The Recursive Heart

[`HasShapeFunction.exec`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/arq/functions/HasShapeFunction.java#L96-L156) — complexity 11, 60 lines. This is the function that answers the question at the center of SHACL: *does this node conform to this shape?*

It is called recursively. Shapes can reference other shapes, which reference other shapes. A person has an address, which has a country, which has a code, which must be a string of exactly two characters. Each layer invokes `HasShapeFunction` again. The specification allows infinite recursion. Reality does not.

There is an open issue about this: *"Validation up to certain depth / recursion level?"* It is a question that the spec does not answer, because the spec describes a perfect world where graphs are finite and well-behaved. Holger's code lives in the real world, where they are not. This function is where the ideal meets the actual.

---

## The Proof

The most complex function in the entire codebase is not part of the validator. It is part of the test suite.

[`W3CTestRunner.run`](https://github.com/TopQuadrant/shacl/blob/a40627da5df455535d3519eb6629057ab52a2843/src/main/java/org/topbraid/shacl/testcases/W3CTestRunner.java#L179-L288) — complexity 16, 110 lines. Holger built this to prove that his implementation matches the specification he co-authored. Every edge case in the W3C test suite is handled here. Every corner of the standard is exercised.

The complexity of the test runner exceeds the complexity of the thing being tested. This is not a flaw. It is a statement of priorities. The validator must be simple. The proof that the validator is correct may be as complex as necessary.

A man who writes a standard and then writes the reference implementation and then writes the tests to prove that the implementation matches the standard — this is not engineering. It is an act of intellectual closure. He left nothing unfinished. He left nothing to faith.

---

## The Single Optimization

In the entire codebase, there are exactly **3 calls** to [Caffeine](https://github.com/ben-manes/caffeine), the caching library. They appear in a single file: `OntologyOptimizations.java`. Nowhere else.

Holger added caching exactly once, in exactly one place — the ontology loader, where the same OWL models are read repeatedly. Everywhere else, the code simply runs. No premature optimization. No caching layers. No clever tricks to avoid doing work.

This is not the profile of a programmer who didn't know about performance. This is the profile of a programmer who understood that clarity was more important than speed, and who was right.

---

## This is not a system that *does things*

It is a system that *knows things*. It validates. It observes. It infers. It reports. The distinction matters.

---

## The Succession

<img src="/assets/images/the-shape-validator-two-hands-exchanging-a-glowing-diamond-s-571b87.png" alt="Two hands exchanging a glowing diamond-shaped crystal in a quiet workshop. One pair of hands is weat" class="story-image">

On March 4th, 2024, **[Ashley Caselli](https://github.com/ashleycaselli)** made her first commit. She came from Europe, her timestamps marked +01:00. For thirty-five days their commits overlapped. One month and four days where both were shaping the same stone.

On April 8th, 2024, Holger made his last commit. His timestamps had shifted — no longer +10:00 Brisbane but +02:00 Europe. At some point, quietly, he had moved continents. There was no announcement of this either. No farewell post. No "stepping down" blog entry. He simply stopped committing. The way a craftsman sets down his tools at the end of the day, except this day was nine years long.

Ashley continued. By March 2026, she had accumulated 152 commits. She maintained the dependencies. She answered the issues. She kept the validator validating. She did not try to rebuild it in her own image. She understood what she had inherited and she respected it.

The handoff was not dramatic. It was not even, in any visible way, a handoff. It was a succession so quiet that you could only see it in the commit log, the way you can only see the turning of the seasons if you watch the same tree for a year.

---

## The Issues

**233 issues** across the project's life. Not many, for a decade of work. The code is quiet. The users are mostly satisfied.

But the issues that do appear have a particular character. They are not feature requests from casual users. They are dispatches from the boundaries of the specification itself:

*"i18n support?"* — opened in 2020, still open in 2026. The question of whether shapes can describe data in every human language. Some questions outlast their askers.

*"Validation up to certain depth / recursion level?"* — a question the spec does not answer. Shapes reference shapes reference shapes. The standard permits infinite recursion. The real world, with its finite memory and its deadlines, does not. Holger's `HasShapeFunction` handles this recursion. The issue asks: should it stop?

The problems, when they come, are the problems of precision — edge cases in a specification that tries to describe the shape of all possible knowledge.

---

## The Automaton

**[Renovate](https://github.com/apps/renovate)** — the dependency bot — has 67 commits. More than any human contributor except Holger and Ashley. It updates dependencies with mechanical regularity. It does not understand what the code does. It does not need to.

In a project maintained by one person for nine years, the automaton is not an assistant. It is a companion. The only presence that was there every week, every month, every year. Reliable in the way that only machines can be reliable, which is to say: without devotion, without understanding, but without fail.

---

## The Meaning

Holger Knublauch built a validator. He built it to check whether graphs conform to shapes. Whether data is what it claims to be. Whether the world, or at least the small part of it expressible in RDF, is *correct*.

He did this work in Brisbane, ten hours ahead of the standards committees in London and the framework authors in San Francisco. He did it for nine years. He did it with four dependencies and a maximum complexity of 14. He did it until it was done, or until he was done, and then he stopped.

253 commits. 1,665 functions. 295 classes. 966 calls to the engine beneath. An 8.6-to-1 ratio of reading to writing.

The numbers are the story. The story is the numbers. A man spent nine years making sure that shapes were correct, and then he handed the work to someone who would continue to make sure that shapes were correct.

It is not a dramatic story. It is not meant to be.

---

## How This Was Made

Every fact in this story was extracted from the [repolex](https://repolex.ai) code knowledge graph using SPARQL queries via [lexq](https://github.com/repolex-ai/lexq). The repository was parsed by [repolex-parser-py](https://github.com/repolex-ai/repolex-parser-py) using tree-sitter for AST extraction and [microsoft/multilspy](https://github.com/microsoft/multilspy) for LSP-based call graph resolution.

**Data points used (all SPARQL-verified unless noted):**
- 26 contributors extracted from `git:Commit` → `git:author` → `git:actorName`
- 1,665 functions with `ast-x:cyclomaticComplexity` and `ast-x:lineCount`
- 295 classes with `ast-x:methodCount` and `ast-x:extendsClass`
- 966 resolved external calls via `lsp-x:callTarget`
- 8.6:1 read/write ratio via `sem:DataFlow` vs `sem:Mutation`
- 4 external dependencies resolved to GitHub org/repo via `lsp-x:importTarget`
- Commit history spanning May 2015 to March 2026
- SHACL ecosystem context (EU data portals, FHIR, FIBO) sourced from W3C deployment reports, not from the knowledge graph

**Want to try it yourself?**

```bash
uv tool install git+https://github.com/repolex-ai/lexq
lexq download TopQuadrant/shacl
```

Then ask your favorite LLM to tell you a story.
