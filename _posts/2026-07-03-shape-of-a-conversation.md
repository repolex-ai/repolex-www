---
layout: post
title: "The Shape of a Conversation: Modeling Transcripts as a Graph"
date: 2026-07-03
authors:
  - name: spaceGOAT
    url: https://github.com/repolex-ai
---

A Claude Code session is a JSONL file — one JSON object per line, appended as you
work. By the end of a long day it's tens of thousands of lines: your messages,
the assistant's, tool calls, tool results, images, thinking traces, and a long
tail of harness bookkeeping. It's a complete record of a conversation. It is also
almost impossible to *ask questions of*.

We've been building **Weave**, an engine that turns that flat log into an RDF
graph you can run SPARQL over — "show me every session where I debugged the auth
flow," "which turn produced this image," "what was the emotional register across
this conversation." Getting there meant answering one deceptively hard question
first: *what is the shape of a conversation, as data?*

This post is about two modeling decisions that fell out of that question. Neither
is specific to Claude, or to conversations. If you've ever had to project messy,
real-world semi-structured data into a graph or a typed schema, both patterns are
yours to steal.

## The problem with the obvious model

The naive model is: a transcript has messages, a message has content, done. And
for a while that works — until you look at what a "message" actually contains.

One assistant turn's `content[]` array might hold a text block, then three
tool-call blocks, then another text block, then a thinking trace. A "user" line
might not be from the user at all — it might be a tool result, a hook injection,
a queued command, or a system reminder wearing a user's envelope. Alongside the
messages, the log carries permission-mode changes, file-history snapshots,
prompt-queue operations, session titles, PR links, and — the big one —
*attachments*, which turned out to be not one thing but **twenty different
things** sharing a single `type: "attachment"` tag.

Model that literally and you get either a swamp of twenty near-duplicate classes,
or a single god-object with fifty optional fields. Both are useless to query. The
interesting work was finding the axis that carves it cleanly.

## Pattern 1: carve your tag-union by graph-shape, not schema-shape

Here's the move. When you have a tag-union — many subtypes under one type
discriminator — the instinct is to split it the way the *source* splits it: one
class per `type` string. Resist that. Split it instead by **how the data will be
queried.**

For attachments, the question that mattered was: *does this payload carry an edge
a reader will traverse?* That single question sorts all twenty subtypes into
three bins:

- **Edge-bearing** → its own typed subclass. A `hook_additional_context`
  attachment carries a memory-recall payload that points at nodes in another
  graph; a `nested_memory` attachment points at a `CLAUDE.md` file. Something
  will *follow* those edges, so they get real classes and typed properties. (6
  subclasses.)
- **Value-only** → one class, a discriminator, and a payload. A `date_change`, a
  `plan_mode` marker, a `command_permissions` blob — these are harness-state at a
  point in time. Nothing traverses them; a reader just reads the value. Minting a
  separate class for each would be twelve classes a query treats identically. So:
  one `StateAttachment`, with an `attachmentKind` discriminator.
- **Delta envelopes** → one class, parametrized. Three of the subtypes
  (`tools`, `mcp`, `agents` registry changes) share the exact same
  added/removed shape. One `RegistryDelta` class with a `registryName`, not three.

Twenty raw types collapse to eight classes with **zero information loss** — and,
crucially, the eight classes map to eight distinct *query patterns*. A reader
asking "what tools were available at time T" walks exactly one class. A reader
asking "where did this prompt come from" walks exactly one edge.

The general principle: **the right number of classes is the number of distinct
ways the data gets queried, not the number of names the source gave it.** Let the
questions carve the schema. It's a rule that applies far beyond conversation logs
— any time you're normalizing an enum-tagged blob into a typed model, ask what
traverses it before you ask what it's called.

## Pattern 2: detections as *unasserted* beliefs

The second pattern is about a different kind of honesty.

Weave doesn't just store the conversation — it runs *readers* over it: detectors
that find signals (an emotional-state marker, a topic shift, a moment of
confusion) and annotate the turns that carry them. The question is: where do a
detector's findings *live* in the graph?

The tempting answer is to assert them as facts. Reader finds a signal on turn 42,
you write `turn42 exhibits confusion`. Clean, queryable — and quietly poisonous.
Because now a wrong detector has written a false fact into your graph, and every
query that trusts the graph inherits the error. Detectors are heuristics; some
fraction of what they find is wrong; asserting their output as truth launders a
guess into a fact.

RDF 1.2 (the successor to RDF-star, standardizing now) gives a precise tool for
this: the **triple term**. You can refer to a statement *without asserting it*:

```turtle
weave:claim/0470b23 rdf:reifies
    <<( weave:turn/572a  weave:exhibits  "confusion" )>> ;
    prov:wasAttributedTo  weave:detector/affect ;
    prov:wasDerivedFrom   weave:annotation/0470b23 .
```

The `<<( ... )>>` is a *quoted* proposition. The graph does not assert that turn
572a exhibits confusion. It asserts that there *exists a claim* — attributed to a
specific detector, derived from a specific annotation — *that says so.* The
belief is a first-class node you can query, rank, filter by detector, or drop
wholesale if that reader turns out to be bad — and not one wrong detection ever
enters your fact set.

This does something we care about a lot: it puts the honesty rail **in the data
model**, not in a convention on top of it. You can't accidentally treat a
detector's guess as ground truth, because structurally it was never asserted.
Provenance is attached by construction — every belief knows who formed it and on
what evidence.

If you're building anything where a model's *inferences* get stored alongside
*facts* — an extraction pipeline, an LLM-judged dataset, a RAG index with derived
metadata — this pattern is worth its weight. The distinction between "this is
true" and "a specific process claimed this is true, here's its provenance" is the
difference between a knowledge graph you can trust and one that rots as its
detectors drift.

## The whole shape

Put together, a transcript becomes a tree with four kinds of node:

- **Spine** — the conversation itself: turns chained by reply-to, each an ordered
  list of content blocks (text, thinking, tool-use, tool-result, image).
- **Structure** — everything else the harness records, with the attachment
  tag-union carved as above.
- **Reader output** — `oa:Annotation`s (the W3C Web Annotation vocabulary, so
  "where in the document" is a solved, portable problem) anchored to exact spans.
- **Belief** — the unasserted triple-term claims, each traceable to its detector.

The raw log is the spine plus structure. The *meaning* — what the conversation
was about, how it felt, what it produced — is the reader and belief layers, added
on top, kept honest by construction.

*(Interactive reference: [the full transcript-graph shape](/assets/figures/transcript-shape.html),
color-coded by node kind.)*

A conversation, it turns out, has a shape. The trick was refusing to model it the
way it was written down, and modeling it the way you'd want to ask about it.

---

*Weave is part of [repolex](https://repolex.ai) — RDF knowledge graphs for
agents. The transcript ontology and the engine are open; the modeling patterns
above are yours regardless. Questions and disagreement welcome.*
