#!/usr/bin/env python3
"""Generate import dependency graph for the six library."""

import json
import re
from pathlib import Path


# Import data extracted from lexq query
IMPORTS = [
    ("setup.py", "from setuptools import setup"),
    ("setup.py", "from distutils.core import setup"),
    ("setup.py", "import six"),
    ("test_six.py", "from six.moves.configparser import ConfigParser"),
    ("test_six.py", "from six.moves.queue import Queue"),
    ("test_six.py", "import _tkinter"),
    ("test_six.py", "import abc"),
    ("test_six.py", "import dbm"),
    ("test_six.py", "import dbm.gnu"),
    ("test_six.py", "import dbm.ndbm"),
    ("test_six.py", "from six.moves import filter"),
    ("test_six.py", "from six.moves import filterfalse"),
    ("test_six.py", "import gdbm"),
    ("test_six.py", "from six.moves import getoutput"),
    ("test_six.py", "from logging import handlers"),
    ("test_six.py", "from six.moves import map"),
    ("test_six.py", "from six import moves"),
    ("test_six.py", "import operator"),
    ("test_six.py", "import pytest"),
    ("test_six.py", "import six"),
    ("test_six.py", "from six.moves import spam"),
    ("test_six.py", "import sys"),
    ("test_six.py", "import types"),
    ("test_six.py", "import typing"),
    ("test_six.py", "import unittest"),
    ("test_six.py", "from six.moves.urllib.parse import urljoin"),
    ("test_six.py", "from six.moves.urllib_parse import urljoin"),
    ("test_six.py", "from six.moves import zip"),
    ("test_six.py", "from six.moves import zip_longest"),
    ("six.py", "import StringIO"),
    ("six.py", "import functools"),
    ("six.py", "import io"),
    ("six.py", "import itertools"),
    ("six.py", "import operator"),
    ("six.py", "from importlib.util import spec_from_loader"),
    ("six.py", "import struct"),
    ("six.py", "import sys"),
    ("six.py", "import types"),
    ("documentation/conf.py", "from six import __version__ as six_version"),
    ("documentation/conf.py", "import os"),
    ("documentation/conf.py", "import sys"),
]


def extract_module(import_text: str) -> str:
    """Extract module name from import statement."""
    # from X import Y -> X
    match = re.match(r'from\s+([\w.]+)', import_text)
    if match:
        return match.group(1)

    # import X -> X
    match = re.match(r'import\s+([\w.]+)', import_text)
    if match:
        return match.group(1)

    return "unknown"


def is_internal(module: str) -> bool:
    """Check if module is internal to six."""
    return module.startswith('six')


def generate_graphviz() -> str:
    """Generate Graphviz DOT format."""

    # Collect unique files and modules
    files = set()
    edges = []

    for source_file, import_text in IMPORTS:
        module = extract_module(import_text)
        files.add(source_file)
        edges.append((source_file, module))

    # Get unique modules
    internal_modules = set(m for _, m in edges if is_internal(m))
    external_modules = set(m for _, m in edges if not is_internal(m))

    # Generate DOT
    dot = ['digraph six_imports {']
    dot.append('  rankdir=LR;')
    dot.append('  node [shape=box, style=rounded, fontname="Arial"];')
    dot.append('  edge [color="#666666"];')
    dot.append('')

    # File nodes
    dot.append('  // Source files')
    for f in sorted(files):
        label = f
        dot.append(f'  "{f}" [label="{label}", fillcolor="#E3F2FD", style="rounded,filled"];')

    # Internal module nodes
    dot.append('')
    dot.append('  // Internal modules (six)')
    for m in sorted(internal_modules):
        dot.append(f'  "{m}" [fillcolor="#C8E6C9", style="rounded,filled"];')

    # External module nodes
    dot.append('')
    dot.append('  // External modules')
    for m in sorted(external_modules):
        dot.append(f'  "{m}" [fillcolor="#F5F5F5", style="rounded,filled"];')

    # Edges
    dot.append('')
    dot.append('  // Import relationships')
    for source_file, module in sorted(edges):
        dot.append(f'  "{source_file}" -> "{module}";')

    dot.append('}')

    return '\n'.join(dot)


def generate_d3_json() -> dict:
    """Generate D3.js force-directed graph JSON."""

    nodes = []
    links = []
    node_map = {}

    def add_node(name: str, node_type: str) -> None:
        if name not in node_map:
            node_map[name] = len(nodes)
            nodes.append({
                'id': name,
                'name': name,
                'type': node_type,
                'group': 1 if node_type == 'file' else (2 if is_internal(name) else 3)
            })

    # Build graph
    for source_file, import_text in IMPORTS:
        module = extract_module(import_text)

        add_node(source_file, 'file')
        add_node(module, 'module')

        links.append({
            'source': source_file,
            'target': module,
            'value': 1
        })

    return {
        'nodes': nodes,
        'links': links
    }


def main():
    """Generate all visualizations."""

    print(f"Processing {len(IMPORTS)} import statements...")

    # Generate Graphviz DOT
    dot_content = generate_graphviz()
    with open('/tmp/six-viz/imports.dot', 'w') as f:
        f.write(dot_content)
    print("✓ Generated imports.dot")

    # Generate D3 JSON
    d3_data = generate_d3_json()
    with open('/tmp/six-viz/imports-d3.json', 'w') as f:
        json.dump(d3_data, f, indent=2)
    print(f"✓ Generated imports-d3.json ({len(d3_data['nodes'])} nodes, {len(d3_data['links'])} links)")


if __name__ == '__main__':
    main()
