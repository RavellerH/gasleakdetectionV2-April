const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3002';
const OUT = path.join(__dirname, 'presentation', 'screenshots-ru');
const VIEWPORT = { width: 1440, height: 900 };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function clickNav(page, label) {
  return page.evaluate((lbl) => {
    for (const el of document.querySelectorAll('div, button, a')) {
      const text = el.textContent?.trim();
      if (text && text.length < 40 && text.includes(lbl)) { el.click(); return true; }
    }
    return false;
  }, label);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  // Use non-headless so GPU/WebGL renders Mapbox tiles properly
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
    ],
    defaultViewport: VIEWPORT,
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // ── Login ──────────────────────────────────────────────────────────────
  console.log('[1] Login...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await sleep(500);
  await page.focus('input[type="email"]');
  await page.keyboard.type('admin@gld.com');
  const btn = await page.$('button');
  if (btn) await btn.click(); else await page.keyboard.press('Enter');
  await sleep(4000);
  await page.waitForNetworkIdle({ timeout: 8000 }).catch(() => {});
  await sleep(2000);

  // ── Map View — plain ───────────────────────────────────────────────────
  console.log('[2] Map View (no selection)...');
  await clickNav(page, 'Map View');
  await sleep(12000); // Mapbox tile load + fly-to-RU animation
  await page.screenshot({ path: path.join(OUT, '05-map.png') });
  console.log('  ✓ 05-map.png');

  // ── Select a device then show popup ───────────────────────────────────
  console.log('[3] Selecting device from Devices tab...');
  await clickNav(page, 'Devices');
  await sleep(2500);
  await page.evaluate(() => {
    const rows = document.querySelectorAll('tbody tr');
    if (rows.length > 0) rows[0].click();
  });
  await sleep(800);

  console.log('[4] Map View with popup...');
  await clickNav(page, 'Map View');
  await sleep(12000); // fly animation (2s) + tile re-render + popup
  await page.screenshot({ path: path.join(OUT, '05-map-popup.png') });
  console.log('  ✓ 05-map-popup.png');

  const popup = await page.evaluate(() => {
    const p = document.querySelector('.mapboxgl-popup');
    return { visible: !!p, text: p?.textContent?.slice(0, 120) };
  });
  console.log('  Popup state:', JSON.stringify(popup));

  await browser.close();
  console.log('\nDone!');
})();
