#!/usr/bin/env python3
"""
TradeITM Image Generator — DALL-E 3
Generates high-quality images via the OpenAI API and saves them locally.
"""

import argparse
import base64
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path


def find_api_key():
    """Look for the OpenAI API key in env vars and .env files."""
    # 1. Check environment variable
    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key

    # 2. Check common .env files relative to script or project root
    search_dirs = [
        Path.cwd(),
        Path(__file__).resolve().parent.parent.parent,  # project root
    ]

    for d in search_dirs:
        for env_file in [".env.local", ".env"]:
            env_path = d / env_file
            if env_path.exists():
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("OPENAI_API_KEY="):
                            val = line.split("=", 1)[1].strip().strip('"').strip("'")
                            if val:
                                return val
    return None


def generate_image(prompt: str, output: str, size: str, quality: str, style: str):
    """Call the DALL-E 3 API and save the resulting image."""
    api_key = find_api_key()
    if not api_key:
        print("ERROR: No OpenAI API key found.", file=sys.stderr)
        print("Set OPENAI_API_KEY env var or add it to .env.local", file=sys.stderr)
        sys.exit(1)

    # Validate params
    valid_sizes = ["1024x1024", "1792x1024", "1024x1792"]
    if size not in valid_sizes:
        print(f"ERROR: Invalid size '{size}'. Must be one of: {valid_sizes}", file=sys.stderr)
        sys.exit(1)

    if quality not in ["standard", "hd"]:
        print(f"ERROR: Invalid quality '{quality}'. Must be 'standard' or 'hd'.", file=sys.stderr)
        sys.exit(1)

    if style not in ["vivid", "natural"]:
        print(f"ERROR: Invalid style '{style}'. Must be 'vivid' or 'natural'.", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    out_path = Path(output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Generating image...")
    print(f"  Prompt: {prompt[:100]}{'...' if len(prompt) > 100 else ''}")
    print(f"  Size: {size} | Quality: {quality} | Style: {style}")

    # Build request
    payload = json.dumps({
        "model": "dall-e-3",
        "prompt": prompt,
        "n": 1,
        "size": size,
        "quality": quality,
        "style": style,
        "response_format": "b64_json",
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        if e.code == 429:
            print("ERROR: Rate limited. Wait a minute and try again.", file=sys.stderr)
        elif e.code == 400:
            print(f"ERROR: Bad request — {error_body}", file=sys.stderr)
        elif e.code == 401:
            print("ERROR: Invalid API key.", file=sys.stderr)
        else:
            print(f"ERROR: HTTP {e.code} — {error_body}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    # Extract and save image
    image_data = body["data"][0]
    revised_prompt = image_data.get("revised_prompt", "")
    b64 = image_data["b64_json"]

    img_bytes = base64.b64decode(b64)
    with open(out_path, "wb") as f:
        f.write(img_bytes)

    file_size_kb = len(img_bytes) / 1024
    print(f"\nSaved: {out_path} ({file_size_kb:.0f} KB)")
    if revised_prompt:
        print(f"\nRevised prompt: {revised_prompt[:200]}{'...' if len(revised_prompt) > 200 else ''}")

    return str(out_path)


def main():
    parser = argparse.ArgumentParser(description="Generate images with DALL-E 3")
    parser.add_argument("--prompt", required=True, help="Image description")
    parser.add_argument("--output", default="./generated_image.png", help="Output file path")
    parser.add_argument("--size", default="1792x1024", choices=["1024x1024", "1792x1024", "1024x1792"])
    parser.add_argument("--quality", default="hd", choices=["standard", "hd"])
    parser.add_argument("--style", default="vivid", choices=["vivid", "natural"])

    args = parser.parse_args()
    generate_image(args.prompt, args.output, args.size, args.quality, args.style)


if __name__ == "__main__":
    main()
