#!/usr/bin/env python3
"""
split_prompts.py - Helper script to split session prompts into slash workflow files.
Usage:
    python tools/split_prompts.py docs/ANTIGRAVITY_PHASE1_PROMPTS-2.md .agent/workflows
    python tools/split_prompts.py docs/ANTIGRAVITY_PHASE1_PROMPTS-2.md .agents/workflows
"""

import sys
import re
from pathlib import Path

def split_prompts(prompt_file: Path, output_dir: Path):
    if not prompt_file.exists():
        print(f"Error: Prompt file '{prompt_file}' does not exist.")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)
    content = prompt_file.read_text(encoding="utf-8")

    # Pattern matches: <!-- SESSION: <id> | <title> -->\n```text\n<body/prompt>\n```\n<!-- END SESSION -->
    pattern = re.compile(
        r'<!--\s*SESSION:\s*([a-zA-Z0-9_\-]+)\s*\|\s*([^>]+?)\s*-->\s*```(?:text)?\s*(.*?)\s*```\s*<!--\s*END SESSION\s*-->',
        re.DOTALL
    )

    matches = pattern.findall(content)
    if not matches:
        # Fallback pattern without enclosing code blocks
        pattern_fallback = re.compile(
            r'<!--\s*SESSION:\s*([a-zA-Z0-9_\-]+)\s*\|\s*([^>]+?)\s*-->\s*(.*?)\s*<!--\s*END SESSION\s*-->',
            re.DOTALL
        )
        matches = pattern_fallback.findall(content)

    print(f"Found {len(matches)} sessions in {prompt_file.name}.")

    for session_id, title, prompt_body in matches:
        out_file = output_dir / f"{session_id}.md"
        workflow_text = f"# {session_id}: {title.strip()}\n\n{prompt_body.strip()}\n"
        out_file.write_text(workflow_text, encoding="utf-8")
        print(f"  Created workflow: {out_file.name}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tools/split_prompts.py <prompts.md> <output_dir>")
        sys.exit(1)

    split_prompts(Path(sys.argv[1]), Path(sys.argv[2]))
