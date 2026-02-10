const { chromium } = require('/sessions/admiring-serene-bohr/mnt/ITM-gd/node_modules/playwright');

(async () => {
  const browser = await chromium.launch();

  // Cards to capture with their target sizes
  const cards = [
    // Landscape 1200x630
    { id: 'landscape-core', file: 'card-landscape-core.png', width: 1200, height: 630, displayW: 600, displayH: 315 },
    { id: 'landscape-pro', file: 'card-landscape-pro.png', width: 1200, height: 630, displayW: 600, displayH: 315 },
    { id: 'landscape-exec', file: 'card-landscape-exec.png', width: 1200, height: 630, displayW: 600, displayH: 315 },
    // Story 1080x1920
    { id: 'story-core', file: 'card-story-core.png', width: 1080, height: 1920, displayW: 360, displayH: 640 },
    { id: 'story-pro', file: 'card-story-pro.png', width: 1080, height: 1920, displayW: 360, displayH: 640 },
    { id: 'story-exec', file: 'card-story-exec.png', width: 1080, height: 1920, displayW: 360, displayH: 640 },
    // Square 1080x1080
    { id: 'square-core', file: 'card-square-core.png', width: 1080, height: 1080, displayW: 400, displayH: 400 },
    { id: 'square-pro', file: 'card-square-pro.png', width: 1080, height: 1080, displayW: 400, displayH: 400 },
    { id: 'square-exec', file: 'card-square-exec.png', width: 1080, height: 1080, displayW: 400, displayH: 400 },
  ];

  for (const card of cards) {
    const dpr = card.width / card.displayW;
    const page = await browser.newPage({
      viewport: { width: 1400, height: 2200 },
      deviceScaleFactor: dpr,
    });

    await page.goto('file:///sessions/admiring-serene-bohr/mnt/ITM-gd/trade-card-formats.html', { waitUntil: 'networkidle' });

    // Wait for fonts
    await page.waitForTimeout(1500);

    const el = await page.$(`#${card.id}`);
    if (el) {
      await el.screenshot({ path: `/sessions/admiring-serene-bohr/mnt/ITM-gd/public/${card.file}` });
      console.log(`Captured ${card.file} (${card.width}x${card.height})`);
    } else {
      console.log(`Element #${card.id} not found!`);
    }
    await page.close();
  }

  await browser.close();
  console.log('Done — all cards captured.');
})();
