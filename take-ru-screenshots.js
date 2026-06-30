const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'http://localhost:3002';
const OUT = path.join(__dirname, 'presentation', 'screenshots-ru');
const VIEWPORT = { width: 1440, height: 900 };

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function shot(page, name) {
  await sleep(2000);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
    defaultViewport: VIEWPORT,
  });

  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  // 1. Login screen
  console.log('[1] Login screen...');
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(1500);
  await shot(page, '01-login');

  // Login
  console.log('[2] Logging in...');
  await page.focus('input[type="email"]');
  await page.keyboard.type('admin@gld.com');
  await sleep(300);
  const loginBtn = await page.$('button');
  if (loginBtn) await loginBtn.click();
  else await page.keyboard.press('Enter');
  await sleep(3500);
  await page.waitForNetworkIdle({ timeout: 8000 }).catch(() => {});
  await sleep(2000);

  // 2. Overview
  console.log('[3] Overview...');
  await shot(page, '02-overview');

  async function clickNavItem(label) {
    const found = await page.evaluate((lbl) => {
      const allEls = [...document.querySelectorAll('div, button, a')];
      for (const el of allEls) {
        const style = window.getComputedStyle(el);
        if (style.cursor !== 'pointer') continue;
        const text = el.textContent?.trim();
        if (text && text.length < 60 && text.includes(lbl)) {
          el.click();
          return { found: true, text };
        }
      }
      return { found: false };
    }, label);
    if (!found.found) console.log(`  ! Not found: "${label}"`);
    else console.log(`  → clicked: "${found.text}"`);
    return found.found;
  }

  const tabs = [
    { label: 'Devices',     file: '03-devices' },
    { label: 'Unit Layout', file: '04-unit-layout' },
    { label: 'Map View',    file: '05-map' },
    { label: 'Alerts',      file: '06-alerts' },
    { label: 'Events',      file: '07-events' },
    { label: 'Analytics',   file: '08-analytics' },
    { label: 'Settings',    file: '09-settings' },
  ];

  for (const t of tabs) {
    console.log(`[tab] ${t.label}`);
    await clickNavItem(t.label);
    await sleep(3000);
    await shot(page, t.file);
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to presentation/screenshots-ru/');
})();
