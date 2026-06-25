---
layout: post
title: "Talking About Episodic Memory for AI Companions Tonight in SF"
date: 2026-06-25
authors:
  - name: Rob Kunkle
    url: https://github.com/goodlux
---

Tonight I'm giving a talk in San Francisco about **episodic memory for AI companions** — part of a project I've been calling **Subtexture**.

It started as a detour. I was curious what would happen if a conversation's text became the source of a running log of *generations* — using a vision diffusion model to snapshot the conversation as it happened, each turn of the dialogue becoming an image. What I found was a whole new way of thinking about memory for agents: instead of searching over words and text, why not search over *snapshots*?

The talk walks through how that experiment turned into an architecture — content-addressed image "Moments" with their meaning in metadata, a knowledge-graph store, on-device vision and diffusion models, and a two-store privacy split where the shareable memory and the private crucible are separated *by construction, not by policy*. It picks up where my [git-lex talk](/talks/circuit-launch-april-2026/) left off.

[**Slides are here**](/talks/episodic-memory-companions-june-2026/) if you want to follow along.

More to come — I'm writing this between sessions, so I'll flesh out the full story (and the components: Pool, OpenIris, Weave, CoPIA) in a follow-up post soon.
