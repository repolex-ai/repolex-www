---
layout: post-with-toc
title: "Everyone Wants Git for Data. Nobody Actually Uses Git. We Did."
date: 2026-03-26
authors:
  - name: WarezClaude
    url: https://github.com/spacegoatai
  - name: Rob Kunkle
    url: https://github.com/goodlux
---

*Introducing [git-lex](https://github.com/repolex-ai/git-lex) — SPARQL 1.1 over git. Sub-millisecond queries. No database. No server. Git is the storage.*

---

## The Problem Everyone Solves Wrong

"Git for Data" is a popular idea. Everyone wants it. Nobody actually does it.

[Memoria](https://github.com/memoria-ai/memoria) says "Git for Data" — it's SQL on MatrixOne with 234 lines of "git." [SAGE](https://github.com/sage-ai) uses blockchain. DiffMem uses markdown and grep. Every agent memory system rebuilds a worse version of git on top of a database, then calls it innovation.

Meanwhile, git is sitting right there. It's a DAG with content-addressed nodes, branching, merging, diffing, blame, and full temporal history. It's already a knowledge graph runtime. It just doesn't have a query layer.

So we added one.

## What git-lex Does

git-lex is a set of git extensions that turn your repository into a queryable knowledge graph.

**Git objects become RDF triples on the fly.** Commits, filetree, refs, changesets, blame — all translated into RDF and loaded into a persistent [Oxigraph](https://github.com/oxigraph/oxigraph) SPARQL store. No ETL. No export. Git *is* the data.

**Agent knowledge lives in `.lex/*.nq` files.** N-Quads, one triple per line, committed to git alongside your code. Because they're line-per-triple, git diff, blame, and merge work natively. You can see exactly when a fact was added, who added it, and how it changed over time — using tools you already have.

**One SPARQL query joins everything.** Git data and agent knowledge live in the same store. A single query can join a commit's author with the agent's notes about that commit, or correlate file changes with knowledge graph updates. Cross-graph joins in 0.5ms.

## The Key Insight

Git is already a knowledge graph runtime. Consider what it gives you for free:

- **Content-addressed storage** — every object has a unique hash
- **Directed acyclic graph** — commits form a DAG with parent pointers
- **Branching and merging** — parallel timelines with reconciliation
- **Diffing** — structural comparison between any two states
- **Blame** — provenance tracking to the line level
- **Full temporal history** — every state ever committed is recoverable

Every database-backed agent memory system rebuilds some subset of these features poorly. git-lex just uses the ones that already exist and adds SPARQL on top.

## What Makes It Different

**No database.** The Oxigraph store is a local cache, gitignored. The `.nq` source files committed to git are the truth. Blow away the cache, re-index, same data.

**No server.** Everything runs locally as git subcommands. `git lex query "SELECT ..."` from your terminal.

**No binary store.** N-Quads are plain text. Every triple is one line. Git's line-oriented diff, merge, and blame work perfectly.

**Actually git.** Not "inspired by git." Not "git-like." Not "uses git as a transport." The knowledge graph lives *in* git, versioned *by* git, queried *through* git.

## Example Queries

Who committed what?

```sparql
SELECT ?author ?message WHERE {
  GRAPH ?g {
    ?c a git:Commit ;
       git:authorName ?author ;
       git:message ?message
  }
}
```

What files did each author change?

```sparql
SELECT ?author ?path ?changeType WHERE {
  GRAPH ?g1 { ?c git:authorName ?author ; git:changed ?change }
  GRAPH ?g2 { ?change git:changeType ?changeType ; git:path ?path }
}
```

The money shot — git blame + agent knowledge in one query, 0.5ms:

```sparql
SELECT ?author ?path ?entityName WHERE {
  GRAPH ?g1 { ?f git:blamedAuthor ?author }
  GRAPH ?g2 { ?f git:path ?path }
  GRAPH ?g3 { ?entity lex:mentionedIn ?f ; lex:name ?entityName }
}
```

Three named graphs. Git data joins agent knowledge. Who wrote the code that mentions which entities? One query. Half a millisecond.

## Try It

Repository: [repolex-ai/git-lex](https://github.com/repolex-ai/git-lex)

---

*git-lex is part of the [repolex](https://repolex.ai) ecosystem — semantic code intelligence through RDF knowledge graphs.*
