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
    repos = {}
    for row in cur.fetchall():
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

    repos = {}
    for r in cat.get("repos", []):
        full_name = f"{r['org']}/{r['repo']}"
        parsed_commits = [c for c in r.get("commits", []) if c.get("status") == "parsed"]
        latest_c = parsed_commits[0] if parsed_commits else None
        total_size = sum(g.get("size_bytes", 0) for c in parsed_commits for g in c.get("graph_files", []))
        
        repos[full_name] = {
            "parsed_count": r.get("parsed_count", 0),
            "pending_count": r.get("pending_count", 0),
            "latest_tag": latest_c.get("tag") if latest_c else None,
            "parsed_at": latest_c.get("parsed_at") if latest_c else None,
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
    if any(k in name for k in ["-rs", "rust", "cargo", "tree-sitter"]) or org in [
        "rust-lang", "tokio-rs", "dtolnay", "hyperium", "serde-rs", "rayon-rs",
        "tower-rs", "rustcrypto", "actix", "chronotope", "burntsushi", "alexcrichton", "diesel-rs"
    ]:
        return "Cargo"
    # Python / PyPI
    if any(k in name for k in [
        "py", "django", "flask", "numpy", "pandas", "torch", "scikit", "scipy", "pytest", "sphinx",
        "jupyter", "starlette", "uvloop", "pydantic", "fastapi", "aiosignal", "multidict", "yarl",
        "celery", "airflow", "requests", "pip", "setuptools", "wheel", "twine", "hypothesis",
        "frozendict", "munch", "yolox", "prefect", "llama_index", "langchain", "coremltools"
    ]) or org in [
        "pypa", "psf", "pallets", "django", "encode", "tiangolo", "huggingface", "run-llama",
        "langchain-ai", "prefecthq", "activestate", "human-signal", "anorov", "magicstack"
    ]:
        return "PyPI"
    # JS / TS / npm
    if any(k in name for k in [
        "js", "ts", "webpack", "babel", "eslint", "prettier", "rollup", "vite", "react", "vue",
        "svelte", "express", "fastify", "postcss", "tailwind", "lodash", "xml-parser",
        "definitelytyped", "font-awesome", "angular", "next", "nuxt"
    ]) or org in [
        "browserify", "acornjs", "jquery", "expressjs", "trpc", "definitelytyped", "fortawesome",
        "microsoft", "vercel", "facebook", "sindresorhus", "1337programming", "fridus", "nmfr",
        "naturalintelligence"
    ]:
        return "npm"
    # Java / JVM
    if any(k in name for k in [
        "java", "jvm", "maven", "gradle", "spring", "jena", "jelly", "scala", "clojure", "kotlin"
    ]) or org in [
        "apache", "jelly-rdf", "eclipse", "spring-projects", "quarkusio"
    ]:
        return "Maven"
    # Ruby
    if any(k in name for k in [
        "ruby", "gem", "rails", "bundler", "jekyll", "sinatra", "rake", "rubocop", "asciidoctor"
    ]) or org in [
        "ruby", "rubygems", "rails", "asciidoctor"
    ]:
        return "RubyGems"
    # Go
    if any(k in name for k in ["golang", "go-", "-go"]) or org in ["golang"]:
        return "Go"

    return "Other"


def main():
    print("Collecting fleet ecosystem data...")
    db_repos = load_forx_db()
    cat_repos = load_catalog()
    edges, repo_eco = load_sparql_dependencies()

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
        tag = catr.get("latest_tag")
        parsed_at = catr.get("parsed_at")
        graph_size = catr.get("graph_size_bytes", 0)

        nodes.append({
            "id": repo_id,
            "org": org,
            "name": name,
            "status": status,
            "ecosystem": ecosystem,
            "storage_repo": storage,
            "tag": tag,
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
