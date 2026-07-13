#!/usr/bin/env node
/**
 * Download OpenStreetMap raster tiles for offline / local use.
 *
 * The map (DeviceMap.tsx) automatically serves tiles from public/tiles
 * when public/tiles/manifest.json exists — no internet needed at runtime.
 *
 * Usage:
 *   npm run tiles            # tiles for the RU in NEXT_PUBLIC_RU_ID (.env/.env.local)
 *   npm run tiles -- RU5     # tiles for a specific RU
 *   npm run tiles -- all     # tiles for every RU site (~large download)
 *
 * Downloads a country-level overview (z4–6) plus a detailed area around
 * the RU site (z7–16). Zoom levels beyond 16 are upscaled by the map
 * renderer, so they don't need to be downloaded.
 */
import { mkdir, writeFile, access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR  = join(ROOT, 'public', 'tiles');
const TILE_URL = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
// OSM tile usage policy requires an identifying User-Agent
const USER_AGENT = 'gas-leak-detection-dashboard/2.1 (offline tile prefetch; github.com/RavellerH/gasleakdetectionV2-April)';

const RU_CENTERS = {
  RU2: { lat: 1.6785,  lng: 101.4725 }, // Dumai, Riau
  RU3: { lat: -2.9782, lng: 104.7994 }, // Plaju, Palembang
  RU4: { lat: -7.7196, lng: 108.9887 }, // Cilacap, Central Java
  RU5: { lat: -1.2627, lng: 116.8162 }, // Balikpapan, East Kalimantan
  RU6: { lat: -6.3717, lng: 108.3881 }, // Balongan, Indramayu
  RU7: { lat: -1.3157, lng: 131.0332 }, // Kasim, Sorong
};

/* how many tiles around the site center to grab, per zoom (center ± pad) */
const SITE_ZOOM_PAD = { 7:1, 8:1, 9:1, 10:2, 11:2, 12:3, 13:3, 14:4, 15:4, 16:6 };
const OVERVIEW_ZOOMS = [4, 5, 6];
/* Indonesia bounding box for the overview zooms */
const OVERVIEW_BBOX = { west: 94, south: -12, east: 142, north: 7 };

const lng2tile = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2tile = (lat, z) => {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};
const clamp = (v, z) => Math.min(Math.max(v, 0), 2 ** z - 1);

async function resolveRuId() {
  const arg = process.argv[2];
  if (arg) return arg.toUpperCase();
  for (const f of ['.env.local', '.env', '.env.example']) {
    try {
      const txt = await readFile(join(ROOT, f), 'utf8');
      const m = txt.match(/^NEXT_PUBLIC_RU_ID=(.+)$/m);
      if (m) return m[1].trim().toUpperCase();
    } catch { /* file absent — try next */ }
  }
  return 'ALL';
}

function collectTiles(ruIds) {
  const tiles = new Set();
  for (const z of OVERVIEW_ZOOMS) {
    const x0 = lng2tile(OVERVIEW_BBOX.west, z),  x1 = lng2tile(OVERVIEW_BBOX.east, z);
    const y0 = lat2tile(OVERVIEW_BBOX.north, z), y1 = lat2tile(OVERVIEW_BBOX.south, z);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.add(`${z}/${x}/${y}`);
  }
  for (const ru of ruIds) {
    const { lat, lng } = RU_CENTERS[ru];
    for (const [zStr, pad] of Object.entries(SITE_ZOOM_PAD)) {
      const z = Number(zStr);
      const cx = lng2tile(lng, z), cy = lat2tile(lat, z);
      for (let x = cx - pad; x <= cx + pad; x++)
        for (let y = cy - pad; y <= cy + pad; y++)
          tiles.add(`${z}/${clamp(x, z)}/${clamp(y, z)}`);
    }
  }
  return [...tiles];
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function fetchTile(key, attempt = 1) {
  const dest = join(OUT_DIR, `${key}.png`);
  if (await exists(dest)) return 'skipped';
  const res = await fetch(TILE_URL(...key.split('/')), { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      await new Promise(r => setTimeout(r, 1500 * attempt));
      return fetchTile(key, attempt + 1);
    }
    throw new Error(`HTTP ${res.status} for ${key}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return 'downloaded';
}

async function main() {
  const ruId = await resolveRuId();
  const ruIds = ruId === 'ALL' ? Object.keys(RU_CENTERS) : [ruId];
  for (const ru of ruIds) {
    if (!RU_CENTERS[ru]) {
      console.error(`Unknown RU "${ru}". Valid: ${Object.keys(RU_CENTERS).join(', ')}, ALL`);
      process.exit(1);
    }
  }

  const tiles = collectTiles(ruIds);
  console.log(`Sites: ${ruIds.join(', ')} — ${tiles.length} tiles → ${OUT_DIR}`);

  let done = 0, skipped = 0, failed = 0;
  const CONCURRENCY = 4;
  for (let i = 0; i < tiles.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(tiles.slice(i, i + CONCURRENCY).map(k => fetchTile(k)));
    for (const r of results) {
      if (r.status === 'rejected') { failed++; console.warn(`  ! ${r.reason.message}`); }
      else if (r.value === 'skipped') skipped++;
      else done++;
    }
    if ((i / CONCURRENCY) % 25 === 0) {
      process.stdout.write(`  ${Math.min(i + CONCURRENCY, tiles.length)}/${tiles.length}\r`);
    }
    await new Promise(r => setTimeout(r, 120)); // be polite to the OSM tile servers
  }

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sites: ruIds,
    overviewZooms: OVERVIEW_ZOOMS,
    siteZooms: Object.keys(SITE_ZOOM_PAD).map(Number),
    tileCount: tiles.length,
    attribution: '© OpenStreetMap contributors',
  }, null, 2));

  console.log(`\nDone: ${done} downloaded, ${skipped} already present, ${failed} failed.`);
  console.log('The map will now use these local tiles automatically (manifest.json detected).');
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => { console.error(err); process.exit(1); });
