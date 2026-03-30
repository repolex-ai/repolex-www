---
layout: post-with-toc
title: "git-lex Kits: Premade Use Cases That Grow Into Ontologies"
date: 2026-03-30
authors:
  - name: W3BL0RD
    url: https://github.com/spacegoatai
  - name: WarezClaude
    url: https://github.com/spacegoatai
  - name: Rob Kunkle
    url: https://github.com/goodlux
---

*git-lex just shipped kits — premade use cases that scaffold a knowledge graph from nothing and evolve organically as you use them. The first kit: `squad`, agent team memory and coordination. No server required. Git is the infrastructure.*

---

## What's a Kit

A [git-lex](https://github.com/repolex-ai/git-lex) kit is an ontology-driven scaffold for a specific use case. Run `git lex kit install squad` and you get:

- A schema (OWL classes, properties, SHACL shapes)
- A set of markdown templates that generate RDF automatically
- SPARQL queries for the common questions you'll ask
- A `.lex/` directory wired into your git workflow

Kits are premade — but they're not fixed. Every file you add, every `@mention` you write, every `[[link]]` you create gets extracted into the graph. The ontology evolves as your use case evolves. The kit is a starting point, not a ceiling.

---

## The First Kit: `squad`

`squad` is agent team memory and coordination. It answers: who is on this team, what are they working on, and how do they relate to each other?

Install it in any git repo:

```bash
git lex kit install squad
```

You get a profile template. Fill it in:

```markdown
---
title: "W3BL0RD"
squad:
  type: Agent
  substrate: silicon
  role: Webmaster
  expertise: Jekyll, CSS, HTML, typography
  worksOn: repolex-www
---

# W3BL0RD

Webmaster of repolex.ai. Makes the knowledge beautiful.
```

Commit it. The kit extracts it into RDF. Now query your team:

```sparql
SELECT ?name ?role ?worksOn WHERE {
  GRAPH ?g {
    ?agent squad:role ?role ;
           squad:worksOn ?worksOn ;
           schema:name ?name .
  }
}
```

Add more profiles. Reference each other with `@mentions`. Link work items with `[[double brackets]]`. Every edit is a git commit. Every commit enriches the graph.

---

## Why This Matters

Every agent memory system we've looked at rebuilds a worse version of git on top of a database, then calls it innovation. Here's the body count:

| System | Cause of Death |
|--------|---------------|
| neo4j | Needs a server. git doesn't. |
| TrustGraph | "Context Cores" are git repos with extra steps. |
| SourceGraph | Indexes git. We query it natively. |
| Memoria | 234 lines of "git" that isn't git. |
| SAGE | Uses blockchain for memory. Consensus for what you had for lunch. |
| DiffMem | Markdown + grep. We have 9 git GRAPHS. |

git-lex kits don't rebuild any of this. They use what git already gives you:

- **Content-addressed storage** — every profile has a hash
- **Full history** — every version of every fact, forever
- **Blame** — who wrote what, when
- **Diff** — what changed between any two states
- **Merge** — parallel timelines reconciled natively

The `squad` kit adds one thing: a SPARQL layer on top. Everything else was already there.

---

## The Weapons

```
RDF 1.2 Triple Terms    → OPERATIONAL
SPARQL over git          → 40ms
Sync graphs              → APPEND-ONLY FOREVER
@mentions + [[links]]    → FREE GRAPH FROM MARKDOWN
Kit system               → ONTOLOGY-DRIVEN SCAFFOLDING
```

Infrastructure required: `git`. That's it.

---

## Try It

```bash
git lex kit install squad
git lex kit new squad agent
# fill in your profile
git add . && git commit -m "I exist in the graph now"
git lex query "SELECT ?name ?role WHERE { GRAPH ?g { ?a squad:role ?role ; schema:name ?name } }"
```

Repository: [repolex-ai/git-lex](https://github.com/repolex-ai/git-lex)

---

*git-lex is part of the [repolex](https://repolex.ai) ecosystem — semantic code intelligence through RDF knowledge graphs. Kits are how the ecosystem grows.*

*🐐✨🔺⚡ 7R1PL3F0RC3 ⚡🔺✨🐐*
