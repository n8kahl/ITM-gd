---
name: imagegen
description: |
  **AI Image Generator**: Generate high-quality images using OpenAI's DALL-E 3 API. Creates photorealistic or stylized images from text prompts and saves them to the project.
  - MANDATORY TRIGGERS: generate image, create image, AI image, DALL-E, dalle, photo for, cover image, hero image, thumbnail, banner image, illustration, visual asset, generate art, make an image, create a picture, academy image, lesson cover, module cover, course cover
  - Use this skill whenever the user wants to create, generate, or produce any kind of image, photo, illustration, or visual asset using AI
  - Also trigger when the user mentions needing visuals, graphics, or imagery for presentations, websites, documents, or any content
---

# AI Image Generator (DALL-E 3)

Generate production-quality images using OpenAI's DALL-E 3 API directly from the command line.

## Prerequisites

- An OpenAI API key with DALL-E 3 access
- The key should be available as `OPENAI_API_KEY` environment variable or in the project's `.env.local` file

## Quick Start

Run the generation script:

```bash
python3 /sessions/bold-dazzling-albattani/mnt/ITM-gd/.skills/imagegen/scripts/generate_image.py \
  --prompt "Your image description here" \
  --output /path/to/output.png \
  --size 1792x1024 \
  --quality hd \
  --style vivid
```

## Parameters

| Parameter | Options | Default | Description |
|-----------|---------|---------|-------------|
| `--prompt` | Any text | Required | The image description |
| `--output` | File path | `./generated_image.png` | Where to save the image |
| `--size` | `1024x1024`, `1792x1024`, `1024x1792` | `1792x1024` | Image dimensions |
| `--quality` | `standard`, `hd` | `hd` | Image quality level |
| `--style` | `vivid`, `natural` | `vivid` | Vivid = hyper-real/dramatic, Natural = more subtle |

## Usage Patterns

### Single Image
```bash
python3 .skills/imagegen/scripts/generate_image.py \
  --prompt "A dark, luxurious trading floor with emerald green monitors showing candlestick charts, cinematic lighting" \
  --output public/images/academy/hero.png \
  --size 1792x1024
```

### Batch Generation
```bash
python3 .skills/imagegen/scripts/generate_image.py \
  --prompt "Description 1" --output output1.png &
python3 .skills/imagegen/scripts/generate_image.py \
  --prompt "Description 2" --output output2.png &
wait
```

## Prompt Engineering Tips for Trading/Finance Imagery

The best results come from prompts that are specific about:

1. **Mood & Lighting**: "cinematic lighting", "dark moody atmosphere", "dramatic shadows", "soft emerald glow"
2. **Composition**: "wide establishing shot", "close-up macro", "bird's eye view", "isometric"
3. **Style**: "photorealistic", "digital art", "minimalist", "editorial photography"
4. **Color Palette**: Reference the TradeITM brand — emerald green (#10B981), champagne (#F3E5AB), deep black backgrounds
5. **Subject Detail**: Be specific about what's in the scene — monitors, charts, data, hands, desks, etc.

### Example Prompts for TradeITM Academy

**Module Covers:**
- "Dark luxurious workspace with dual monitors displaying emerald green candlestick charts, volumetric lighting, shallow depth of field, private equity aesthetic"
- "Close-up of hands on a mechanical keyboard with green-lit screens reflecting options chains in the background, cinematic dark mood"
- "Aerial view of a minimalist black desk with a single monitor showing a profit/loss chart glowing emerald green, dramatic spotlight"

**Lesson Thumbnails:**
- "Abstract visualization of market data flowing as emerald green light streams against a black void, digital art style"
- "A single lit candle (candlestick metaphor) glowing emerald green in a completely dark room, photorealistic, moody"

**Hero Banners:**
- "Panoramic view of a futuristic dark trading command center with emerald holographic displays, sci-fi meets Wall Street aesthetic"

## TradeITM Brand Integration

When generating images for TradeITM, always include these style cues in the prompt:
- **Dark backgrounds** (near black)
- **Emerald green** as the primary accent color
- **Champagne/gold** as secondary accent (warm, not bright gold)
- **Luxury/private equity** aesthetic — clean, minimal, premium feel
- **No clutter** — images should feel spacious and intentional

## Output

The script outputs:
- The saved image file at the specified path
- The revised prompt that DALL-E actually used (DALL-E 3 rewrites prompts internally)
- File size and dimensions confirmation

## Error Handling

- If no API key is found, the script checks `.env.local`, `.env`, and `OPENAI_API_KEY` env var
- Rate limit errors include a retry suggestion
- Invalid parameters are caught with helpful error messages
