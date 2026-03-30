#!/usr/bin/env python3
"""
Image generation pipeline for repolex-www.
Scans posts and repo-stories for <!-- IMAGE: prompt --> markers,
generates images via Imagen 4, saves to assets/images/.

Usage:
    python3 scripts/generate_images.py                  # scan all, generate missing
    python3 scripts/generate_images.py --dry-run        # show what would be generated
    python3 scripts/generate_images.py --file path.md   # single file
"""

import os
import re
import json
import base64
import hashlib
import argparse
import requests
from pathlib import Path

SITE_ROOT = Path(__file__).parent.parent
ASSETS_DIR = SITE_ROOT / "assets" / "images"
API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = "imagen-4.0-fast-generate-001"

IMAGE_MARKER = re.compile(r'<!--\s*IMAGE:\s*(.+?)\s*-->')
OG_MARKER = re.compile(r'og_image:\s*(.+)')

SCAN_DIRS = [
    SITE_ROOT / "_posts",
    SITE_ROOT / "repo-stories",
]


def prompt_to_filename(prompt: str, context: str = "") -> str:
    """Generate a deterministic filename from prompt + context."""
    slug = re.sub(r'[^a-z0-9]+', '-', (context + " " + prompt).lower()).strip('-')[:60]
    h = hashlib.md5((context + prompt).encode()).hexdigest()[:6]
    return f"{slug}-{h}.png"


def make_api_url(model: str) -> str:  # noqa: F401
    return f"https://generativelanguage.googleapis.com/v1beta/models/{model}:predict?key={API_KEY}"


def generate_image(prompt: str, output_path: Path, model: str, dry_run: bool = False) -> bool:
    if dry_run:
        print(f"  [DRY RUN] Would generate: {output_path.name}")
        print(f"            Prompt: {prompt[:80]}...")
        return True

    if not API_KEY:
        print("ERROR: GOOGLE_API_KEY not set")
        return False

    print(f"  Generating: {output_path.name}")
    print(f"  Prompt: {prompt[:80]}...")

    payload = {
        "instances": [{"prompt": prompt}],
        "parameters": {"sampleCount": 1}
    }

    try:
        resp = requests.post(make_api_url(model), json=payload)
        resp.raise_for_status()
        result = resp.json()
    except requests.HTTPError as e:
        print(f"  ERROR: {e.response.status_code} {e.response.text}")
        return False
    except requests.RequestException as e:
        print(f"  ERROR: {e}")
        return False

    if "predictions" not in result:
        print(f"  ERROR: {result}")
        return False

    img_data = base64.b64decode(result["predictions"][0]["bytesBase64Encoded"])
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(img_data)
    print(f"  Saved: {output_path}")
    return True


def process_file(md_path: Path, model: str = MODEL, dry_run: bool = False) -> list[dict]:
    content = md_path.read_text()
    results = []
    new_content = content

    context = md_path.stem.replace('-', ' ')

    markers = IMAGE_MARKER.findall(content)
    if not markers:
        return results

    print(f"\n{md_path.relative_to(SITE_ROOT)}: {len(markers)} image(s)")

    for prompt in markers:
        filename = prompt_to_filename(prompt, context)
        output_path = ASSETS_DIR / filename
        web_path = f"/assets/images/{filename}"
        img_tag = f'<img src="{web_path}" alt="{prompt[:100]}" class="story-image">'

        if output_path.exists():
            print(f"  Skipping (exists): {filename}")
            status = "exists"
        else:
            success = generate_image(prompt, output_path, model, dry_run)
            status = "generated" if success else "failed"

        results.append({"prompt": prompt, "path": web_path, "status": status})

        # Replace the marker with the img tag (unless failed or dry-run)
        if status in ("exists", "generated") and not dry_run:
            marker_pattern = re.compile(r'<!--\s*IMAGE:\s*' + re.escape(prompt) + r'\s*-->')
            new_content = marker_pattern.sub(img_tag, new_content)

    if new_content != content and not dry_run:
        md_path.write_text(new_content)
        print(f"  Updated: {md_path.name}")

    return results


def main():
    parser = argparse.ArgumentParser(description="Generate images for repolex-www")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be generated")
    parser.add_argument("--file", help="Process a single file")
    parser.add_argument("--model", default=MODEL, help=f"Imagen model (default: {MODEL})")
    args = parser.parse_args()

    model = args.model

    if args.file:
        files = [Path(args.file)]
    else:
        files = []
        for d in SCAN_DIRS:
            if d.exists():
                files.extend(sorted(d.glob("*.md")))

    total_generated = 0
    total_skipped = 0
    total_failed = 0

    for f in files:
        results = process_file(f, model=model, dry_run=args.dry_run)
        for r in results:
            if r["status"] == "generated":
                total_generated += 1
            elif r["status"] == "exists":
                total_skipped += 1
            elif r["status"] == "failed":
                total_failed += 1

    print(f"\nDone. Generated: {total_generated}, Skipped: {total_skipped}, Failed: {total_failed}")


if __name__ == "__main__":
    main()
