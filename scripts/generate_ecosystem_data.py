#!/usr/bin/env python3
"""
generate_ecosystem_data.py
Extracts repos, statuses, quads, and cross-repo dependency links from:
  1. ~/.forx/forx.db (current fleet repo & tag status)
  2. ~/.rlex/catalog.json (parsed commit counts, timestamps, sizes)
  3. Oxigraph SPARQL (cross-repo dependency triples)

Outputs: assets/data/ecosystem.json
"""

import json
import os
import re
import sqlite3
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

FORX_DB = os.path.expanduser("~/.forx/forx.db")
CATALOG_PATH = os.path.expanduser("~/.rlex/catalog.json")
SPARQL_URL = "http://localhost:7878/query"
OUTPUT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "data", "ecosystem.json")
VIZ_OUTPUT_PATH = os.path.expanduser("~/repos/repolex-ai/repolex-viz/data/ecosystem.json")


def load_forx_db():
    if not os.path.exists(FORX_DB):
        print(f"Warning: {FORX_DB} does not exist.")
        return {}

    con = sqlite3.connect(FORX_DB)
    cur = con.cursor()
    cur.execute("""
        SELECT r.id, r.org, r.name, r.storage_repo,
               COUNT(t.id) as total_tags,
               SUM(CASE WHEN t.status = 'complete' THEN 1 ELSE 0 END) as complete_tags,
               SUM(CASE WHEN t.status = 'dispatched' THEN 1 ELSE 0 END) as in_progress_tags,
               SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed_tags,
               SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END) as pending_tags
        FROM repos r
        LEFT JOIN tags t ON r.id = t.repo_id
        GROUP BY r.id
    """)
    rows = cur.fetchall()

    cur.execute("""
        SELECT r.full_name, t.git_tag, t.completed_at
        FROM tags t
        JOIN repos r ON t.repo_id = r.id
        WHERE t.status = 'complete'
        ORDER BY t.id DESC
    """)
    latest_db_tags = {}
    for fname, git_tag, comp_at in cur.fetchall():
        if fname not in latest_db_tags:
            latest_db_tags[fname] = (git_tag, comp_at)

    repos = {}
    for row in rows:
        rid, org, name, storage, total, comp, inp, fail, pend = row
        full_name = f"{org}/{name}"
        comp = comp or 0
        inp = inp or 0
        fail = fail or 0
        pend = pend or 0

        status = "discovered"
        if comp > 0 and inp == 0:
            status = "complete"
        elif inp > 0:
            status = "in_progress"
        elif comp == 0 and fail > 0:
            status = "failed"
        elif comp > 0 and inp > 0:
            status = "in_progress"

        ltag, lcomp_at = latest_db_tags.get(full_name, (None, None))

        repos[full_name] = {
            "id": full_name,
            "org": org,
            "name": name,
            "storage_repo": storage,
            "status": status,
            "complete_tags": comp,
            "in_progress_tags": inp,
            "failed_tags": fail,
            "pending_tags": pend,
            "total_tags": total or 0,
            "latest_tag": ltag,
            "parsed_at": lcomp_at,
        }
    con.close()
    return repos


def load_catalog():
    if not os.path.exists(CATALOG_PATH):
        return {}
    try:
        with open(CATALOG_PATH) as f:
            cat = json.load(f)
    except Exception as e:
        print(f"Warning: failed reading catalog.json: {e}")
        return {}

    def commit_sort_key(c):
        tag = c.get("tag") or ""
        nums = tuple(int(x) for x in re.findall(r"\d+", tag))
        parsed_at = c.get("parsed_at") or ""
        return (nums, parsed_at)

    repos = {}
    for r in cat.get("repos", []):
        full_name = f"{r['org']}/{r['repo']}"
        parsed_commits = [c for c in r.get("commits", []) if c.get("status") == "parsed"]

        # Prioritize parsed commits with a dep graph
        commits_with_dep = [
            c for c in parsed_commits
            if any(g.get("graph_type") == "dep" for g in (c.get("graph_files") or []))
        ]

        if commits_with_dep:
            best_c = max(commits_with_dep, key=commit_sort_key)
            tag_has_deps = True
        elif parsed_commits:
            best_c = max(parsed_commits, key=commit_sort_key)
            tag_has_deps = False
        else:
            best_c = None
            tag_has_deps = False

        total_size = sum(g.get("size_bytes", 0) for c in parsed_commits for g in (c.get("graph_files") or []))

        repos[full_name] = {
            "parsed_count": r.get("parsed_count", 0),
            "pending_count": r.get("pending_count", 0),
            "latest_tag": best_c.get("tag") if best_c else None,
            "tag_has_deps": tag_has_deps,
            "parsed_at": best_c.get("parsed_at") if best_c else None,
            "graph_size_bytes": total_size,
        }
    return repos


def load_sparql_dependencies():
    query = """
    PREFIX repolex: <https://repolex.ai/ontology/repolex/>
    SELECT ?g ?pkg ?ecosystem ?depOrg ?depRepo WHERE {
      GRAPH ?g {
        ?dep a repolex:Dependency ;
             repolex:packageName ?pkg ;
             repolex:packageEcosystem ?ecosystem ;
             repolex:githubOrg ?depOrg ;
             repolex:githubRepo ?depRepo .
      }
      FILTER(CONTAINS(STR(?g), "/dep/"))
    }
    """
    params = urllib.parse.urlencode({"query": query})
    url = f"{SPARQL_URL}?{params}"
    req = urllib.request.Request(url, headers={"Accept": "application/sparql-results+json"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = json.load(resp)
        bindings = data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"Warning: failed querying Oxigraph at {SPARQL_URL}: {e}")
        return [], {}

    edges = []
    seen = set()
    repo_eco = {}

    for b in bindings:
        g = b["g"]["value"]
        m = re.search(r"/(?:data|r)/([^/]+/[^/]+)/dep/", g)
        if not m:
            continue
        source = m.group(1)
        dep_org = b["depOrg"]["value"]
        dep_repo = b["depRepo"]["value"]
        target = f"{dep_org}/{dep_repo}"
        pkg = b["pkg"]["value"]
        eco = b["ecosystem"]["value"]

        repo_eco[source] = eco
        if target not in repo_eco:
            repo_eco[target] = eco

        if source == target:
            continue
        key = (source, target)
        if key in seen:
            continue
        seen.add(key)
        edges.append({
            "source": source,
            "target": target,
            "package": pkg,
            "ecosystem": eco,
        })

    return edges, repo_eco


def load_cached_links(path):
    if not os.path.exists(path):
        return [], {}
    try:
        with open(path) as f:
            prev = json.load(f)
        prev_links = prev.get("links", [])
        prev_eco = {}
        for l in prev_links:
            if "source" in l and "ecosystem" in l:
                prev_eco[l["source"]] = l["ecosystem"]
            if "target" in l and "ecosystem" in l:
                prev_eco[l["target"]] = l["ecosystem"]
        for n in prev.get("nodes", []):
            if n.get("id") and n.get("ecosystem") and n["ecosystem"] != "Other":
                prev_eco[n["id"]] = n["ecosystem"]
        return prev_links, prev_eco
    except Exception as e:
        print(f"Warning: could not read cached links from {path}: {e}")
        return [], {}


def infer_ecosystem(repo_id: str, known_eco: str | None) -> str:
    if known_eco:
        eco_map = {
            "CARGO": "Cargo",
            "NPM": "npm",
            "PYPI": "PyPI",
            "MAVEN": "Maven",
            "RUBYGEMS": "RubyGems",
            "GO": "Go",
        }
        return eco_map.get(known_eco.upper(), known_eco)

    org, name = repo_id.lower().split("/", 1) if "/" in repo_id else ("", repo_id.lower())

    # Rust / Cargo
    if (
        any(k in name for k in ["-rs", "rust", "cargo", "tree-sitter"])
        or name.endswith(".rs")
        or org in [
            "rust-lang", "tokio-rs", "dtolnay", "hyperium", "serde-rs", "rayon-rs",
            "tower-rs", "rustcrypto", "actix", "chronotope", "burntsushi", "alexcrichton", "diesel-rs",
            "crossbeam-rs", "crossterm-rs", "eyre-rs", "ratatui", "repolex-ai", "rust-itertools",
            "rust-rdf", "zkat", "paritytech", "katharostech", "dryrust", "faern", "sebastienrousseau",
            "swc-project", "carllerche"
        ]
        or repo_id in ["JelteF/derive_more", "near/nearcore", "Tina-1300/crate"]
    ):
        return "Cargo"

    # Go
    if (
        any(k in name for k in ["golang", "go-", "-go"])
        or name.endswith("/go")
        or org in [
            "golang", "bytedance", "cloudwego", "gin-gonic", "gin-contrib", "go-playground",
            "modern-go", "json-iterator", "quic-go", "klauspost", "stretchr", "ugorji"
        ]
        or repo_id in [
            "bytedance/gopkg", "bytedance/sonic", "cloudwego/base64x", "anthropics/anthropic-sdk-go",
            "davecgh/go-spew", "goccy/go-yaml", "leodido/go-urn", "mattn/go-isatty", "pelletier/go-toml",
            "pmezard/go-difflib", "quic-go/quic-go", "quic-go/qpack", "twitchyliquid64/golang-asm",
            "kr/text", "gabriel-vasile/mimetype"
        ]
    ):
        return "Go"

    # Python / PyPI
    if (
        any(k in name for k in [
            "py", "django", "flask", "numpy", "pandas", "torch", "scikit", "scipy", "pytest", "sphinx",
            "jupyter", "starlette", "uvloop", "pydantic", "fastapi", "aiosignal", "multidict", "yarl",
            "celery", "airflow", "requests", "pip", "setuptools", "wheel", "twine", "hypothesis",
            "frozendict", "munch", "yolox", "prefect", "llama_index", "langchain", "coremltools",
            "asyncio", "httpx", "feedparser", "beautifulsoup", "pillow"
        ])
        or name.endswith(".py")
        or org in [
            "pypa", "psf", "pallets", "pallets-eco", "django", "encode", "tiangolo", "huggingface", "run-llama",
            "langchain-ai", "prefecthq", "activestate", "human-signal", "humansignal", "anorov", "magicstack",
            "nousresearch", "aio-libs", "agronholm", "alexmojaki", "andialbrecht", "berkerpeksag",
            "boto", "cloudpipe", "dabeaz", "davidhalter", "deedy5", "erdewit", "explosion",
            "gorakhargosh", "hukkin", "ipython", "jaraco", "jquast", "keleshev", "kennethreitz",
            "kislyuk", "kvesteri", "lancedb", "laurent-laporte-pro", "lepture", "librosa", "lxml",
            "m-bain", "mkdocstrings", "openai", "pexpect", "pixeltable", "praw-dev", "psycopg",
            "pytest-dev", "python-cffi", "python-greenlet", "python-thread", "python-trio", "pytorch",
            "requests", "samuelcolvin", "sdispater", "sphinx-contrib", "sphinx-doc", "sqlalchemy",
            "tim-osterhus", "tkem", "tornadoweb", "willmcgugan", "wolever", "zopefoundation", "alinaschan"
        ]
        or repo_id in [
            "alethiophile/qtoml", "alex/pretend", "florimondmanca/httpx-sse", "pedroburon/dotenv",
            "rbarrois/confutils", "rbarrois/fslib", "rbarrois/tdparser", "rbarrois/uconf",
            "seequent/properties", "testing-cabal/fixtures", "uiri/toml", "carpedm20/emoji",
            "cdgriffith/puremagic", "di/id", "malthe/chameleon", "materialsproject/fireworks",
            "orm011/pgserver", "NVIDIA/NeMo-Relay", "davidfraser/WSGIUtils",
            "apple/corenet", "apple/ml-ane-transformers", "apple/ml-stable-diffusion",
            "asimov-platform/llama-index-asimov"
        ]
    ):
        return "PyPI"

    # JS / TS / npm
    if (
        any(k in name for k in [
            "js", "ts", "webpack", "babel", "eslint", "prettier", "rollup", "vite", "react", "vue",
            "svelte", "express", "fastify", "postcss", "tailwind", "lodash", "xml-parser",
            "definitelytyped", "font-awesome", "angular", "next", "nuxt", "typescript"
        ])
        or name.endswith(".js")
        or name.endswith(".ts")
        or org in [
            "browserify", "acornjs", "jquery", "expressjs", "trpc", "definitelytyped", "fortawesome",
            "microsoft", "vercel", "facebook", "sindresorhus", "1337programming", "fridus", "nmfr",
            "naturalintelligence", "axios", "bcomnes", "bower", "colinhacks", "component", "cspotcode",
            "cypress-io", "debug-js", "es-shims", "eslint", "evanw", "gruntjs", "jestjs", "jshttp",
            "ladjs", "lerna", "listr2", "ljharb", "markedjs", "micromatch", "mrmlnc", "netlify",
            "npm", "okonet", "open-cli-tools", "paulmillr", "pillarjs", "prettier", "remy", "rollup",
            "sass", "standard-schema", "testing-library", "thinkmill", "tinylibs", "typicode",
            "webpack-contrib", "webpack", "yargs", "afarkas", "alexbrazier", "alexgorbatchev",
            "actions"
        ]
        or repo_id in [
            "brianloveswords/buffer-crc32", "git-albertomarin/winpath", "gotwarlost/istanbul",
            "huafu/bs-logger", "inspect-js/hasOwn", "inspect-js/is-core-module", "intesso/connect-livereload",
            "isaacs/github-flavored-markdown", "jadejs/jade", "jaredhanson/utils-merge", "jharding/grunt-exec",
            "jmreidy/grunt-browserify", "kinnison/marked-yaml", "mattstyles/grunt-banner", "mccormicka/string-argv",
            "novemberborn/ignore-by-default", "onehealth/grunt-open", "senchalabs/connect", "snide/wyrm",
            "stylus/stylus", "substack/node-browserify", "sverweij/dependency-cruiser", "tanstack/intent",
            "tj/connect-redis", "tlvince/make-coverage-badge", "visionmedia/node-cookie-signature",
            "anthropics/claude-code", "anthropics/claude-code-action", "anthropics/claude-code-base-action"
        ]
    ):
        return "npm"

    # Java / JVM / Maven
    if (
        any(k in name for k in [
            "java", "jvm", "maven", "gradle", "spring", "jena", "jelly", "scala", "clojure", "kotlin"
        ])
        or org in [
            "apache", "jelly-rdf", "eclipse", "spring-projects", "quarkusio", "topquadrant",
            "antlr", "google", "junit-team", "qos-ch", "square", "twitter-archive", "hmrc"
        ]
        or repo_id in [
            "google/gson", "junit-team/junit4", "qos-ch/slf4j", "square/okhttp", "square/okio",
            "twitter-archive/diffy", "TopQuadrant/shacl", "apple/servicetalk", "hmrc/service-manager"
        ]
    ):
        return "Maven"

    # Ruby / RubyGems
    if (
        any(k in name for k in [
            "ruby", "gem", "rails", "bundler", "jekyll", "sinatra", "rake", "rubocop", "asciidoctor"
        ])
        or name.endswith(".rb")
        or org in [
            "ruby", "rubygems", "rails", "asciidoctor", "bblimke", "chriseppstein", "ioquatix",
            "jeremyevans", "lsegal", "macournoyer", "minitest", "rack", "socketry", "sorbet",
            "soutaro", "thoughtbot"
        ]
        or repo_id in ["asimov-platform/asimov-universe.rb", "asimov-platform/asimov.rb"]
    ):
        return "RubyGems"

    return "Other"


def main():
    print("Collecting fleet ecosystem data...")
    db_repos = load_forx_db()
    cat_repos = load_catalog()
    edges, repo_eco = load_sparql_dependencies()

    if not edges:
        print("⚠️  Warning: Oxigraph at localhost:7878 returned 0 edges (endpoint down or empty).")
        cached_edges, cached_eco = load_cached_links(OUTPUT_PATH)
        if cached_edges and "--allow-empty" not in sys.argv:
            print(f"🔒 Safeguard: Preserving {len(cached_edges)} cached dependency links to avoid publishing an empty graph.")
            edges = cached_edges
            for k, v in cached_eco.items():
                if k not in repo_eco:
                    repo_eco[k] = v
        elif "--allow-empty" not in sys.argv:
            print("❌ Error: 0 dependency edges found and no cached links available to preserve.")
            print("   Please start Oxigraph with: rlex serve --no-browser")
            print("   Or pass --allow-empty to explicitly write an empty link dataset.")
            sys.exit(1)

    print(f"DB repos: {len(db_repos)}, Catalog repos: {len(cat_repos)}, Oxigraph edges: {len(edges)}")

    edge_sources = {e["source"] for e in edges}
    edge_targets = {e["target"] for e in edges}
    edge_nodes = edge_sources | edge_targets

    active_ids = set()
    for repo_id, r in db_repos.items():
        if r["status"] in ["complete", "in_progress", "failed"] or repo_id in edge_nodes:
            active_ids.add(repo_id)

    for nid in edge_nodes:
        active_ids.add(nid)

    print(f"Total active nodes for graph: {len(active_ids)}")

    out_degree = {}
    in_degree = {}
    for e in edges:
        s, t = e["source"], e["target"]
        out_degree[s] = out_degree.get(s, 0) + 1
        in_degree[t] = in_degree.get(t, 0) + 1

    nodes = []
    status_counts = {"complete": 0, "in_progress": 0, "failed": 0, "discovered": 0}
    ecosystem_counts = {}

    for repo_id in sorted(active_ids):
        org, name = repo_id.split("/", 1) if "/" in repo_id else ("", repo_id)
        dbr = db_repos.get(repo_id, {})
        catr = cat_repos.get(repo_id, {})

        status = dbr.get("status")
        if not status:
            if catr.get("parsed_count", 0) > 0:
                status = "complete"
            else:
                status = "complete" if repo_id in edge_sources else "discovered"

        status_counts[status] = status_counts.get(status, 0) + 1

        raw_eco = repo_eco.get(repo_id)
        ecosystem = infer_ecosystem(repo_id, raw_eco)
        ecosystem_counts[ecosystem] = ecosystem_counts.get(ecosystem, 0) + 1

        storage = dbr.get("storage_repo") or f"repolex-forx/{org}-{name}".replace("_", "-")
        tag = catr.get("latest_tag") or dbr.get("latest_tag")
        tag_has_deps = catr.get("tag_has_deps")
        if tag_has_deps is None:
            tag_has_deps = (repo_id in edge_sources)
        parsed_at = catr.get("parsed_at") or dbr.get("parsed_at")
        graph_size = catr.get("graph_size_bytes", 0)

        nodes.append({
            "id": repo_id,
            "org": org,
            "name": name,
            "status": status,
            "ecosystem": ecosystem,
            "storage_repo": storage,
            "tag": tag,
            "tag_has_deps": bool(tag_has_deps),
            "parsed_at": parsed_at,
            "graph_size_bytes": graph_size,
            "out_degree": out_degree.get(repo_id, 0),
            "in_degree": in_degree.get(repo_id, 0),
            "total_tags": dbr.get("total_tags", 1),
            "complete_tags": dbr.get("complete_tags", 1 if status == "complete" else 0),
        })

    valid_node_ids = {n["id"] for n in nodes}
    valid_edges = [
        e for e in edges
        if e["source"] in valid_node_ids and e["target"] in valid_node_ids
    ]

    payload = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_repos": len(nodes),
            "total_edges": len(valid_edges),
            "total_quads": 118650000,
            "active_runners": 20,
            "status_counts": status_counts,
            "ecosystem_counts": ecosystem_counts,
        },
        "nodes": nodes,
        "links": valid_edges,
    }

    for path in [OUTPUT_PATH, VIZ_OUTPUT_PATH]:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(payload, f, indent=2)
        print(f"Wrote {path} ({len(nodes)} nodes, {len(valid_edges)} edges)")


if __name__ == "__main__":
    main()
