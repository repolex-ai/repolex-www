# repolex-www

> Official website and ontology registry for [Repolex](https://repolex.ai) — Semantic code intelligence and persistent agent infrastructure.

This repository powers [`https://repolex.ai`](https://repolex.ai), hosted on GitHub Pages with Jekyll. It serves as the primary home for the Repolex code graph platform, the open-source ontology portal (`/ontology/`), the interactive Repolex Web explorer (`/web/`), and technical articles.

---

## Site Architecture & Contents

```text
repolex-www/
├── _config.yml               # Jekyll site settings, permalinks, and collections
├── CNAME                     # Domain configuration (repolex.ai)
├── Gemfile                   # Ruby gem dependencies
├── index.html                # Main repolex.ai landing page
├── web/                      # Interactive Repolex Web browser (700+ indexed repositories)
├── ontology/                 # Published RDF/OWL schemas (https://repolex.ai/ontology/)
│   ├── repolex/              # Code graph ontologies (AST, CFG, DFG, Call Graph)
│   ├── git-lex/              # git-lex core, fm, md, and git2 ontologies
│   ├── soul/                 # Persistent agent soul ontology
│   ├── copia/                # CoPIA episodic memory & grounding ontology
│   ├── pan/                  # Pan media store ontology
│   ├── ravel/                # Ravel transcript ontology
│   └── squad/                # Multi-agent federation & bulletin ontology
├── _docs/                    # Technical documentation and guides (/docs/:title/)
├── _posts/                   # Engineering blog and release dispatches
├── _layouts/                 # Jekyll page templates
├── _includes/                # Header, navigation, and footer partials
└── assets/                   # CSS styles, typography, and visual assets
```

---

## Local Development

### Prerequisites
- Ruby (>= 3.0)
- Bundler (`gem install bundler`)

### Running Locally

```bash
# 1. Install dependencies
bundle install

# 2. Start Jekyll development server
bundle exec jekyll serve

# 3. Open in browser
# Navigate to http://localhost:4000
```

To live-reload on changes:

```bash
bundle exec jekyll serve --livereload
```

---

## Authoring Blog Posts & Content

- **Adding Blog Posts (`_posts/`)**:
  Create new files matching `YYYY-MM-DD-title.md` with standard frontmatter:
  ```yaml
  ---
  layout: post
  title: "Your Post Title"
  date: YYYY-MM-DD
  author: "Author Name"
  ---
  ```
- **Updating Ontologies (`ontology/`)**:
  The schemas in `ontology/` are mirrored from their respective source repositories via the automated publish pipeline. Avoid manual edits in `ontology/` without syncing the upstream source `.ttl` definitions.

---

## Deployment

The website is continuously deployed via GitHub Actions and GitHub Pages upon pushing commits to `main`.

---

## License

Developed for the [Repolex](https://repolex.ai) open-source code intelligence ecosystem.
