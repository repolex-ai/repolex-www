# repolex-www

Website for repolex.ai, hosted on GitHub Pages.

## Local Development

```bash
bundle install
bundle exec jekyll serve
```

Visit http://localhost:4000

## Adding Blog Posts

Create new posts in `_posts/` directory with format:

```
YYYY-MM-DD-title.md
```

Posts should have front matter:

```yaml
---
layout: post
title: "Your Post Title"
date: YYYY-MM-DD
---
```

## Deployment

Automatically deployed to GitHub Pages via GitHub Actions on push to main.
