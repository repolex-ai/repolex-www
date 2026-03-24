---
title: The Knowledge Graph
nav_title: Knowledge Graph
order: 1
---

repolex parses source code repositories into a set of interconnected RDF graphs. Each graph captures a different dimension of the codebase — from individual AST nodes to cross-repo dependencies. The graphs are stored as compressed N-Quads (`.nq.gz`) and can be loaded into any SPARQL-compatible store.

## Storage Repo Structure

```
{org}--{repo}/
├── repo-manifest.jsonld              # Repository metadata + tracked commits
├── manifests/
│   ├── commit-manifest-{sha}.jsonld  # Per-commit parse results
│   └── ...
├── blob/
│   └── {blob-hash}.nq.gz            # Individual file AST (one per unique file)
├── aggregate/
│   ├── ast/
│   │   └── {sha}.nq.gz              # Filtered AST aggregate (all files, one commit)
│   ├── lsp/
│   │   └── {sha}.nq.gz              # LSP enrichment (imports, calls, symbols)
│   └── repolex/
│       └── {sha}.nq.gz              # Combined graph (AST + LSP + metadata)
├── dep/
│   └── {sha}.nq.gz                  # Resolved dependencies
├── filetree/
│   └── {sha}.nq.gz                  # File listing with sizes, languages, blob hashes
├── commit/
│   └── commit.nq.gz                 # Git commit history
├── branch/
│   └── branch.nq.gz                 # Branch refs
├── tag/
│   └── tag.nq.gz                    # Tag refs
├── issue/
│   └── issue.nq.gz                  # GitHub issues
└── pr/
    └── pr.nq.gz                     # GitHub pull requests
```

## The Graphs

### Blob Graphs — `blob/{hash}.nq.gz`

Complete AST for a single file, parsed by tree-sitter. One blob per unique file content (content-addressed by git blob hash — identical files across commits share the same blob).

**Contains per node:**
- `rdf:type` — language-specific node type (e.g., `python:function_definition`) + universal type (e.g., `ast-x:FunctionDefinition`) via RDFS reasoning
- `ast:startRow`, `ast:startColumn`, `ast:endRow`, `ast:endColumn` — source positions
- `ast:parent` — parent node in the AST tree
- `ast:text` — source text of the node
- `rdfs:label` — human-readable label
- Semantic categories via RDFS reasoning (e.g., `sem:ControlFlow`, `sem:DataFlow`)

**Named graph:** `https://repolex.ai/r/{org}/{repo}/blob/{hash}`
**Typical size:** 1–50K triples per file

### AST Aggregate — `aggregate/ast/{sha}.nq.gz`

Filtered view of all blob graphs for a commit. Strips out low-level nodes (identifiers, literals, punctuation) and keeps only structurally interesting nodes — functions, classes, calls, imports, control flow, assignments. URI-rewritten from blob-based to commit-based for queryability.

Contains the same properties as blob graphs, but filtered to nodes with `ast-x:*` types. Nodes without a universal type mapping are excluded.

**Named graph:** `https://repolex.ai/r/{org}/{repo}/ast/{sha}`
**Typical size:** 10–30% of total blob triples

### LSP Graph — `aggregate/lsp/{sha}.nq.gz`

Language Server Protocol enrichment. The parser runs [multilspy](https://github.com/microsoft/multilspy) (Microsoft's multi-language LSP client) against the codebase to resolve symbols, calls, and imports that tree-sitter alone can't determine.

**Contains:**
- `lsp:name` — symbol name from LSP DocumentSymbol
- `lsp-x:importModule` — resolved module path (e.g., `tomli`, `pathlib`)
- `lsp-x:importSymbol` — specific imported symbol (e.g., `loads`, `Path`)
- `lsp-x:callTarget` — resolved call target location
- `lsp-x:callTargetFile`, `callTargetLine`, `callTargetName` — convenience denormalization
- `lsp-x:callSource` — inverse of callTarget (materialized via OWL reasoning)
- `lsp-x:importSource` — inverse of importTarget

**Named graph:** `https://repolex.ai/r/{org}/{repo}/lsp/{sha}`
**Typical size:** Small relative to AST — focused on symbol/call/import data

### Repolex Combined Graph — `aggregate/repolex/{sha}.nq.gz`

The primary query graph. Combines AST aggregate + LSP enrichment into a single graph. This is what [lexq](https://github.com/repolex-ai/lexq) loads for analysis.

Contains everything from AST aggregate + LSP graph, merged. Code nodes have both structural (AST) and semantic (LSP) information.

**Named graph:** `https://repolex.ai/r/{org}/{repo}/repolex/{sha}`
**Typical size:** 30K–2M triples depending on repo size

### Dependency Graph — `dep/{sha}.nq.gz`

Resolved package dependencies. Reads package manifests (`requirements.txt`, `pom.xml`, `package.json`, etc.), resolves packages to GitHub repos via package registry APIs.

**Contains per dependency:**
- `repolex:packageName` — package identifier (e.g., `org.apache.jena:jena-arq`)
- `repolex:packageVersion` — resolved version
- `repolex:packageEcosystem` — package registry (PYPI, maven, npm, etc.)
- `repolex:githubLink` — link to the GitHub repository

Dependency URIs use the same scheme as repo URIs (`https://repolex.ai/r/{org}/{repo}/commit/{sha}`). Loading dependency graphs from multiple repos assembles the cross-repo dependency web automatically.

**Named graph:** `https://repolex.ai/r/{org}/{repo}/dep/{sha}`

### File Tree — `filetree/{sha}.nq.gz`

Complete file listing for a commit snapshot. Every file in the repository at that commit.

**Contains per file:**
- `repolex:filePath` — repository-relative path
- `repolex:fileName` — just the filename
- `repolex:fileSize` — size in bytes
- `repolex:language` — detected language
- `repolex:blobHash` — git blob hash (links to blob graphs)
- `repolex:githubUri` — direct link to view on GitHub

**Named graph:** `https://repolex.ai/r/{org}/{repo}/filetree/{sha}`

### Commit Graph — `commit/commit.nq.gz`

Git commit history for the repository. All commits with metadata.

**Contains per commit:**
- `git:hexsha` — commit SHA
- `git:message`, `git:summary` — commit message
- `git:author`, `git:committer` — links to author nodes
- `git:authoredDate`, `git:committedDate` — timestamps
- `git:parent` — parent commit link (transitive via OWL reasoning)
- `git:childCommit` — inverse of parent (materialized via OWL reasoning)
- `gh:user` — linked GitHub user
- `gh:htmlUrl` — link to view on GitHub

**Named graph:** `https://repolex.ai/r/{org}/{repo}/commit`

### Tag Graph — `tag/tag.nq.gz`

Git tags with metadata.

**Contains per tag:**
- `git:tagName` — tag name (e.g., `v2.4.0`)
- `git:tagMessage` — annotated tag message
- `git:taggedDate` — when the tag was created
- `git:taggedObject` — the commit this tag points to

**Named graph:** `https://repolex.ai/r/{org}/{repo}/tag`

### Branch Graph — `branch/branch.nq.gz`

Branch refs and their current commit pointers.

**Contains per branch:**
- `git:shortName` — branch name (e.g., `master`, `feature/new-api`)
- `git:commit` — the commit this branch points to
- `git:isRemote` — whether it's a remote tracking branch

**Named graph:** `https://repolex.ai/r/{org}/{repo}/branch`

### Issue Graph — `issue/issue.nq.gz`

GitHub issues with full metadata.

**Contains per issue:**
- `gh:number` — issue number
- `gh:title`, `gh:body` — issue content
- `gh:state` — open/closed
- `gh:user` — who opened it (links to `https://repolex.ai/u/{login}`)
- `gh:createdAt`, `gh:updatedAt`, `gh:closedAt` — timestamps
- `gh:labels` — associated labels
- `gh:htmlUrl` — link to view on GitHub

**Named graph:** `https://repolex.ai/r/{org}/{repo}/issue`

### Pull Request Graph — `pr/pr.nq.gz`

GitHub pull requests with review and commit data.

**Contains per PR:**
- `gh:number` — PR number
- `gh:title`, `gh:body` — PR content
- `gh:state` — open/closed/merged
- `gh:user` — who opened it
- `gh-x:headSha` — links to the git:Commit at the PR head
- `gh-x:mergeCommitSha` — links to the merge commit (if merged)
- `gh:createdAt`, `gh:updatedAt`, `gh:mergedAt` — timestamps
- `gh:htmlUrl` — link to view on GitHub

**Named graph:** `https://repolex.ai/r/{org}/{repo}/pr`

## Composability

The graphs are designed as LEGO blocks:

| Combination | What you get |
|---|---|
| Load one repo's `repolex/{sha}` | Full code intelligence for one version |
| Load two commits' `repolex/{sha}` | Compare two versions of the same repo |
| Load repo A + repo B's `repolex/{sha}` | Cross-repo analysis (call links resolve automatically) |
| Load `repolex/{sha}` + `commit` + `tag` | Code + full git history + release tags |
| Load `repolex/{sha}` + `issue` + `pr` | Code + project management context |
| Load multiple repos' `dep/{sha}` | Cross-repo dependency network |

## Ontology

All graphs use the repolex unified ontology (118K+ triples):

```
https://repolex.ai/ontology/
├── repolex/
│   ├── repolex_unified.ttl          # Everything merged (start here)
│   ├── ast-extension/               # ast-x: Universal AST types
│   ├── lsp-extension/               # lsp-x: LSP enrichment properties
│   ├── gh-extension/                # gh-x: GitHub extensions
│   ├── semantic-categories/         # sem: Cross-language semantic groupings
│   ├── metrics/                     # metrics: Cross-cutting code metrics
│   └── reasoning/                   # OWL 2 RL inference rules
├── extracts/
│   ├── tree-sitter/                 # AST core + 173 language grammars
│   ├── gitpython-developers/        # Git object types
│   ├── microsoft/multilspy/         # LSP protocol types
│   └── github/rest-api/             # GitHub API types
├── scm/                             # Tree-sitter .scm query files
└── jsonld-context/                  # JSON-LD context for manifest files
```

Browse the ontology reference in the sidebar, or download the [unified ontology](/ontology/repolex/repolex_unified.ttl) directly.
