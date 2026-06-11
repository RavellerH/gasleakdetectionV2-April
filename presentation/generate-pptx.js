// GASGUARD v2.1 — PowerPoint Deck Generator
// Run: node generate-pptx.js
// Output: gasguard-v2.1.pptx

const pptxgen = require('pptxgenjs');
const prs = new pptxgen();

// ── Theme ────────────────────────────────────────────────────────────────────
prs.layout = 'LAYOUT_WIDE'; // 13.33" x 7.5"

const C = {
  navy:   '0f172a',
  navy2:  '1e293b',
  navy3:  '334155',
  blue:   '0284c7',
  blue2:  '0369a1',
  blueL:  'e0f2fe',
  blueB:  'eff6ff',
  blueB2: 'bfdbfe',
  slate:  '64748b',
  slate2: '94a3b8',
  border: 'e2e8f0',
  bg:     'f8fafc',
  white:  'ffffff',
  green:  '16a34a',
  greenL: 'd1fae5',
  amber:  'd97706',
  amberL: 'fef3c7',
  red:    'dc2626',
  redL:   'fee2e2',
  purple: '7c3aed',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function titleSlideStyle(slide) {
  slide.background = { color: C.navy };
}

function sectionStyle(slide) {
  slide.background = { color: '0c2541' };
}

function addTag(slide, text, opts = {}) {
  const { x = 0.5, y = 0.35, color = C.blue, textColor = 'ffffff' } = opts;
  slide.addText(text.toUpperCase(), {
    x, y, w: 2.5, h: 0.22,
    fontSize: 7, bold: true, color: textColor,
    fill: { color }, shape: prs.ShapeType.roundRect, rectRadius: 0.12,
    align: 'center', fontFace: 'Calibri',
  });
}

function addAccentBar(slide, opts = {}) {
  const { x = 0.5, y = 0.65 } = opts;
  slide.addShape(prs.ShapeType.rect, {
    x, y, w: 0.55, h: 0.045, fill: { color: C.blue }, line: { color: C.blue },
  });
}

function addH1(slide, text, opts = {}) {
  const { x = 0.5, y = 0.78, w = 12.33 } = opts;
  slide.addText(text, {
    x, y, w, h: 0.9,
    fontSize: 24, bold: true, color: C.navy, fontFace: 'Calibri',
  });
}

function addBody(slide, text, opts = {}) {
  const { x = 0.5, y = 1.7, w = 5.8, h = 0.4, size = 11 } = opts;
  slide.addText(text, {
    x, y, w, h, fontSize: size, color: C.navy3, fontFace: 'Calibri', wrap: true,
  });
}

function addCard(slide, lines, opts = {}) {
  const { x = 0.5, y = 2.0, w = 5.8, h = 1.2, fill = C.bg, border = C.border } = opts;
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: fill }, line: { color: border, pt: 1 },
  });
  lines.forEach((ln, i) => {
    slide.addText(ln.text, {
      x: x + 0.18, y: y + 0.14 + i * 0.26, w: w - 0.36, h: 0.24,
      fontSize: ln.size || 10, bold: ln.bold || false,
      color: ln.color || C.navy2, fontFace: 'Calibri',
    });
  });
}

function addBullets(slide, items, opts = {}) {
  const { x = 0.5, y = 2.0, w = 5.8, size = 10 } = opts;
  const rows = items.map(t => ({ text: '  ' + t, options: { bullet: { type: 'number' }, color: C.navy3, fontSize: size, fontFace: 'Calibri' } }));
  // pptxgenjs bullet hack: use manual checkmark prefix
  const bulletItems = items.map(t => ({ text: '✓  ' + t }));
  slide.addText(bulletItems, {
    x, y, w, h: items.length * 0.29 + 0.1,
    fontSize: size, color: C.navy3, fontFace: 'Calibri',
    lineSpacingMultiple: 1.3,
  });
}

function addStatBox(slide, num, label, opts = {}) {
  const { x, y, w = 2.8, h = 1.0 } = opts;
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 },
  });
  slide.addText(num, {
    x: x + 0.1, y: y + 0.08, w: w - 0.2, h: 0.55,
    fontSize: 28, bold: true, color: C.blue, align: 'center', fontFace: 'Calibri',
  });
  slide.addText(label.toUpperCase(), {
    x: x + 0.1, y: y + 0.6, w: w - 0.2, h: 0.3,
    fontSize: 8, color: C.slate, align: 'center', fontFace: 'Calibri',
  });
}

function addPill(slide, text, opts = {}) {
  const { x, y, w = 2.8, h = 0.28, color = C.blue } = opts;
  slide.addShape(prs.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.14, fill: { color: C.bg }, line: { color: C.border, pt: 1 },
  });
  slide.addText('●  ' + text, {
    x: x + 0.1, y: y + 0.03, w: w - 0.2, h: h - 0.06,
    fontSize: 9, color: C.navy3, fontFace: 'Calibri',
  });
}

function addLeftBorderCard(slide, title, titleColor, body, opts = {}) {
  const { x, y, w = 5.8, h = 1.1 } = opts;
  slide.addShape(prs.ShapeType.rect, {
    x, y: y, w: 0.055, h, fill: { color: titleColor }, line: { color: titleColor },
  });
  slide.addShape(prs.ShapeType.roundRect, {
    x: x + 0.055, y, w: w - 0.055, h, rectRadius: 0.08,
    fill: { color: C.bg }, line: { color: C.border, pt: 1 },
  });
  slide.addText(title, {
    x: x + 0.2, y: y + 0.1, w: w - 0.35, h: 0.25,
    fontSize: 11, bold: true, color: titleColor, fontFace: 'Calibri',
  });
  slide.addText(body, {
    x: x + 0.2, y: y + 0.34, w: w - 0.35, h: h - 0.44,
    fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true,
  });
}

// ── SLIDES ───────────────────────────────────────────────────────────────────

// ── 1. TITLE ─────────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  titleSlideStyle(s);

  s.addText('GASGUARD v2.1', {
    x: 0.7, y: 2.0, w: 9, h: 1.4,
    fontSize: 52, bold: true, color: C.white, fontFace: 'Calibri',
  });
  s.addText('Intelligent Real-Time Gas Leak Detection\n& Monitoring System for Industrial Refineries', {
    x: 0.7, y: 3.5, w: 9, h: 1.2,
    fontSize: 18, color: C.slate2, fontFace: 'Calibri',
  });
  s.addText('INDUSTRIAL SAFETY PLATFORM  ·  VERSION 2.1', {
    x: 0.7, y: 1.6, w: 9, h: 0.3,
    fontSize: 9, color: '0ea5e9', bold: true, charSpacing: 2, fontFace: 'Calibri',
  });
  s.addText('June 2026  ·  Confidential', {
    x: 9.5, y: 6.9, w: 3.3, h: 0.3,
    fontSize: 9, color: '475569', align: 'right', fontFace: 'Calibri',
  });
  // Pills
  [
    { t: '● 28 Sensors Live', x: 0.7 },
    { t: '● 6 Refinery Units', x: 2.9 },
    { t: '● Real-Time Alerts', x: 5.1 },
  ].forEach(p => {
    s.addShape(prs.ShapeType.roundRect, { x: p.x, y: 5.0, w: 2.0, h: 0.3, rectRadius: 0.15, fill: { color: '1e293b' }, line: { color: '334155', pt: 1 } });
    s.addText(p.t, { x: p.x + 0.1, y: 5.03, w: 1.8, h: 0.24, fontSize: 9, color: C.slate2, fontFace: 'Calibri' });
  });
}

// ── 2. EXECUTIVE SUMMARY ─────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Executive Summary');
  addAccentBar(s);
  addH1(s, 'One platform. Complete refinery\nsafety visibility.');

  const cols = [
    { title: 'Real-Time Monitoring', color: C.blue, body: '28 gas sensors across 6 refinery units reading PPM every 20 seconds. Automatic threshold alerting at Warning (50 ppm) and Critical (80 ppm).' },
    { title: 'Operator Accountability', color: C.amber, body: 'Every event is logged: gas breaches, device faults, logins, acknowledgements. Operators provide documented notes — creating a complete audit trail.' },
    { title: 'Analytics & Compliance', color: C.green, body: '7-day trend analytics, heatmaps, top-risk sensor rankings, and one-click CSV / PDF export for audit, compliance, and RCA.' },
  ];

  cols.forEach((c, i) => addLeftBorderCard(s, c.title, c.color, c.body, { x: 0.3 + i * 4.35, y: 2.3, w: 4.15, h: 1.6 }));

  const stats = [
    { n: '57', l: 'Total Devices' }, { n: '6', l: 'Refinery Units' },
    { n: '4,704', l: 'Readings / 7 Days' }, { n: '20s', l: 'Refresh Interval' },
  ];
  stats.forEach((st, i) => addStatBox(s, st.n, st.l, { x: 0.3 + i * 3.2, y: 4.15, w: 3.0, h: 0.95 }));
}

// ── 3. THE PROBLEM ───────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'The Challenge', { color: C.red });
  addAccentBar(s, { y: 0.65 });
  addH1(s, 'Gas leaks in refineries are\ninvisible until it\'s too late.');

  const problems = [
    { t: '⚠  Safety Risk', c: C.red, b: 'Undetected hydrocarbon gas accumulation leads to explosions, fires, and toxic exposure — the leading cause of industrial fatalities.' },
    { t: '⏱  Slow Response', c: C.amber, b: 'Manual inspection rounds cannot provide continuous coverage. Hours may pass between rounds — a leak may reach critical levels.' },
    { t: '📋  Compliance Burden', c: C.slate, b: 'Regulatory bodies require documented evidence of monitoring, incident response, and corrective actions. Paper trails are incomplete.' },
    { t: '🗺  No Cross-Site Visibility', c: C.blue, b: 'Multiple refinery units with no unified view. Supervisors cannot compare conditions or identify cross-site patterns.' },
    { t: '🔋  Device Blind Spots', c: C.purple, b: 'Battery failures and network disconnections in remote sensors go unnoticed — creating monitoring gaps when coverage is most needed.' },
    { t: '→  GASGUARD solves all of these', c: C.blue, b: 'Continuous monitoring · Instant alerts · Device health tracking · Multi-site visibility · Automated audit trail' },
  ];

  problems.slice(0, 3).forEach((p, i) => addLeftBorderCard(s, p.t, p.c, p.b, { x: 0.3, y: 1.65 + i * 1.7, w: 5.9, h: 1.55 }));
  problems.slice(3, 6).forEach((p, i) => addLeftBorderCard(s, p.t, p.c, p.b, { x: 6.5, y: 1.65 + i * 1.7, w: 6.5, h: 1.55 }));
}

// ── 4. SECTION: SYSTEM DESIGN ────────────────────────────────────────────────
{
  const s = prs.addSlide();
  sectionStyle(s);

  s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: 0.5, w: 1.8, h: 0.28, rectRadius: 0.14, fill: { color: '1e3a5f' }, line: { color: '2d5a8e', pt: 1 } });
  s.addText('SECTION 01', { x: 0.4, y: 0.52, w: 1.8, h: 0.24, fontSize: 8, color: '93c5fd', bold: true, align: 'center', fontFace: 'Calibri' });

  s.addText('System Design\n& Architecture', { x: 0.4, y: 2.2, w: 10, h: 2.0, fontSize: 36, bold: true, color: C.white, fontFace: 'Calibri' });
  s.addText('How GASGUARD is built — the hardware topology, data flow, and the technology stack that powers it.', { x: 0.4, y: 4.3, w: 8, h: 0.8, fontSize: 14, color: C.slate2, fontFace: 'Calibri' });
  s.addText('01', { x: 9.5, y: 4.5, w: 3.5, h: 2.5, fontSize: 100, bold: true, color: '1e293b', fontFace: 'Calibri', align: 'right' });
}

// ── 5. SYSTEM ARCHITECTURE ───────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Architecture');
  addAccentBar(s);
  addH1(s, 'Three-tier architecture', { y: 0.76, h: 0.5 });

  const layers = [
    { tag: 'LAYER 1 — FIELD', title: 'Sensor Network', body: 'Wireless IoT mesh of gas sensors, cluster heads, and gateway nodes deployed across refinery units.', bullets: ['28 MQ-series gas sensors', '22 cluster head relays', '7 gateway nodes (mesh root)', 'Star + mesh hybrid topology'] },
    { tag: 'LAYER 2 — BACKEND', title: 'API & Data Layer', body: 'NestJS server exposes a GraphQL API. Prisma ORM manages all device data, readings, events, and user records.', bullets: ['NestJS — API framework', 'GraphQL — code-first schema', 'Prisma ORM', 'SQLite → upgradeable'] },
    { tag: 'LAYER 3 — FRONTEND', title: 'Operator Dashboard', body: 'Next.js 15 React application. Real-time polling, interactive 3D map, analytics charts, and compliance reports.', bullets: ['Next.js 15 + React', 'Mapbox GL — 3D mapping', 'Recharts — analytics', 'graphql-request client'] },
  ];

  layers.forEach((l, i) => {
    const x = 0.3 + i * 4.35;
    s.addShape(prs.ShapeType.roundRect, { x, y: 1.35, w: 1.9, h: 0.22, rectRadius: 0.11, fill: { color: C.blueB2 }, line: { color: C.blue, pt: 1 } });
    s.addText(l.tag, { x: x + 0.05, y: 1.37, w: 1.8, h: 0.18, fontSize: 7, bold: true, color: C.blue2, align: 'center', fontFace: 'Calibri' });
    s.addText(l.title, { x, y: 1.65, w: 4.15, h: 0.35, fontSize: 14, bold: true, color: C.navy, fontFace: 'Calibri' });
    s.addText(l.body, { x, y: 2.05, w: 4.15, h: 0.8, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });
    s.addShape(prs.ShapeType.roundRect, { x, y: 2.9, w: 4.15, h: 2.2, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    l.bullets.forEach((b, bi) => {
      s.addText('—  ' + b, { x: x + 0.15, y: 3.0 + bi * 0.46, w: 3.85, h: 0.4, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
    });
  });
}

// ── 6. NETWORK TOPOLOGY ──────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Network Design');
  addAccentBar(s);
  addH1(s, 'Star + Mesh hybrid topology', { y: 0.76, h: 0.5 });

  const cards = [
    { icon: '🛜', title: 'Gateway (Mesh Root)', color: C.blue, body: '7 units — forms backbone mesh network. Forwards all aggregated data to the backend server.', detail: 'RSSI: −30 dBm avg · Grade A' },
    { icon: '📡', title: 'Cluster Head (Relay)', color: C.navy3, body: '22 units distributed per RU. Aggregates sensor readings over star topology, relays to gateway.', detail: 'Dual RSSI: mesh + star' },
    { icon: '🔵', title: 'Sensor Node', color: C.slate, body: '28 MQ-series gas sensors. Reports ppm readings every 20 seconds to parent cluster head.', detail: 'Battery: 60–90% SOC' },
  ];

  cards.forEach((c, i) => {
    const y = 1.5 + i * 1.75;
    s.addShape(prs.ShapeType.roundRect, { x: 0.3, y, w: 5.8, h: 1.6, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    s.addText(c.icon + '  ' + c.title, { x: 0.5, y: y + 0.1, w: 5.5, h: 0.3, fontSize: 12, bold: true, color: c.color, fontFace: 'Calibri' });
    s.addText(c.body, { x: 0.5, y: y + 0.42, w: 5.5, h: 0.7, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });
    s.addText(c.detail, { x: 0.5, y: y + 1.25, w: 5.5, h: 0.24, fontSize: 8, color: C.slate, fontFace: 'Calibri' });
  });

  // RU table
  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.3, w: 6.5, h: 5.8, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('RU Device Distribution', { x: 6.8, y: 1.45, w: 6.1, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });

  const headers = ['RU', 'Gateway', 'Cluster Head', 'Sensors'];
  headers.forEach((h, i) => s.addText(h, { x: 6.8 + i * 1.55, y: 1.85, w: 1.4, h: 0.24, fontSize: 9, bold: true, color: C.slate, fontFace: 'Calibri', align: i === 0 ? 'left' : 'center' }));

  const rows = [
    { ru: 'RU2', color: '38bdf8', gw: '1', ch: '3', sns: '10' },
    { ru: 'RU3', color: '34d399', gw: '1', ch: '3', sns: '4' },
    { ru: 'RU4', color: 'f59e0b', gw: '1', ch: '2', sns: '3' },
    { ru: 'RU5', color: 'a78bfa', gw: '1', ch: '1', sns: '2' },
    { ru: 'RU6', color: 'fb7185', gw: '2', ch: '2', sns: '4' },
    { ru: 'RU7', color: '22d3ee', gw: '1', ch: '11', sns: '5' },
    { ru: 'Total', color: C.blue, gw: '7', ch: '22', sns: '28' },
  ];

  rows.forEach((r, i) => {
    const y = 2.2 + i * 0.6;
    if (i === 6) {
      s.addShape(prs.ShapeType.rect, { x: 6.8, y: y - 0.05, w: 6.1, h: 0.04, fill: { color: C.border } });
    }
    s.addText(r.ru, { x: 6.8, y, w: 1.4, h: 0.3, fontSize: 10, bold: true, color: r.color, fontFace: 'Calibri' });
    [r.gw, r.ch, r.sns].forEach((v, vi) => {
      s.addText(v, { x: 6.8 + (vi + 1) * 1.55, y, w: 1.4, h: 0.3, fontSize: 10, bold: i === 6, color: i === 6 ? C.blue : C.navy3, align: 'center', fontFace: 'Calibri' });
    });
  });
}

// ── 7. SECTION: FEATURES ─────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  sectionStyle(s);
  s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: 0.5, w: 1.8, h: 0.28, rectRadius: 0.14, fill: { color: '1e3a5f' }, line: { color: '2d5a8e', pt: 1 } });
  s.addText('SECTION 02', { x: 0.4, y: 0.52, w: 1.8, h: 0.24, fontSize: 8, color: '93c5fd', bold: true, align: 'center', fontFace: 'Calibri' });
  s.addText('Core Features', { x: 0.4, y: 2.2, w: 10, h: 1.0, fontSize: 36, bold: true, color: C.white, fontFace: 'Calibri' });
  s.addText('A walkthrough of every major capability — from real-time dashboard to compliance export.', { x: 0.4, y: 3.3, w: 9, h: 0.6, fontSize: 14, color: C.slate2, fontFace: 'Calibri' });
  const fts = ['Overview Dashboard', 'Interactive 3D Map', 'Device Management', 'Alert System', 'Event Log & Audit', 'Analytics'];
  fts.forEach((f, i) => {
    const row = Math.floor(i / 3), col = i % 3;
    s.addShape(prs.ShapeType.roundRect, { x: 0.4 + col * 3.0, y: 4.2 + row * 0.7, w: 2.8, h: 0.52, rectRadius: 0.08, fill: { color: '1e293b' }, line: { color: '334155', pt: 1 } });
    s.addText(f, { x: 0.5 + col * 3.0, y: 4.27 + row * 0.7, w: 2.6, h: 0.38, fontSize: 10, color: '93c5fd', fontFace: 'Calibri' });
  });
  s.addText('02', { x: 9.5, y: 4.5, w: 3.5, h: 2.5, fontSize: 100, bold: true, color: '1e293b', fontFace: 'Calibri', align: 'right' });
}

// ── 8. DASHBOARD OVERVIEW ────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Dashboard');
  addAccentBar(s);
  addH1(s, 'Unified operator dashboard', { y: 0.76, h: 0.5 });

  addBody(s, 'A dark-themed, real-time operations dashboard providing a complete picture of the refinery gas environment at a glance.', { x: 0.3, y: 1.45, w: 6.0, h: 0.55, size: 10 });

  const kpis = [
    { v: '57', l: 'Total Devices', fill: C.blueB, border: 'bae6fd', vc: C.blue },
    { v: '100%', l: 'Online Rate', fill: 'f0fdf4', border: 'bbf7d0', vc: C.green },
    { v: '78%', l: 'Avg Battery', fill: 'fffbeb', border: 'fde68a', vc: C.amber },
    { v: '6', l: 'Active Alerts', fill: 'fff1f2', border: 'fecdd3', vc: C.red },
  ];
  kpis.forEach((k, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + i * 1.5, y: 2.1, w: 1.38, h: 1.0, rectRadius: 0.1, fill: { color: k.fill }, line: { color: k.border, pt: 1 } });
    s.addText(k.v, { x: 0.3 + i * 1.5, y: 2.2, w: 1.38, h: 0.45, fontSize: 20, bold: true, color: k.vc, align: 'center', fontFace: 'Calibri' });
    s.addText(k.l, { x: 0.3 + i * 1.5, y: 2.68, w: 1.38, h: 0.3, fontSize: 8, color: C.slate, align: 'center', fontFace: 'Calibri' });
  });

  addCard(s, [
    { text: 'RU Filter', bold: true, size: 11 },
    { text: 'Selecting a Refinery Unit scopes ALL KPI cards, gas trend charts, device list, and analytics to that unit. Sidebar alert badge always shows global count.', size: 9, color: C.navy3 },
  ], { x: 0.3, y: 3.3, w: 6.0, h: 1.1 });

  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('Navigation Tabs', { x: 6.8, y: 1.5, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });

  const tabs = [
    'Overview — KPIs, gas trend, RU health',
    'Devices — full fleet table',
    'Unit Layout — topology diagram',
    'Map View — 3D Mapbox satellite',
    'Alerts — live alert panel',
    'Events — audit log',
    'Analytics — trend & heatmap',
    'Settings — thresholds & config',
  ];
  tabs.forEach((t, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 6.8, y: 1.9 + i * 0.58, w: 5.9, h: 0.46, rectRadius: 0.08, fill: { color: C.white }, line: { color: C.border, pt: 1 } });
    s.addText('●  ' + t, { x: 7.0, y: 1.95 + i * 0.58, w: 5.5, h: 0.36, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });
}

// ── 9. REAL-TIME GAS MONITORING ──────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Monitoring');
  addAccentBar(s);
  addH1(s, 'Real-time gas concentration monitoring', { y: 0.76, h: 0.5 });

  addBody(s, 'Every sensor submits PPM readings continuously. The overview chart displays one line per sensor over a rolling 24-hour window — concentration trends visible at a glance.', { x: 0.3, y: 1.45, w: 6.0, h: 0.55, size: 10 });

  const thresh = [
    { v: 'WARNING — 50 ppm', sub: 'Alert logged. Operator notified.', fill: 'fffbeb', border: 'fde68a', c: C.amber },
    { v: 'CRITICAL — 80 ppm', sub: 'Immediate action required.', fill: 'fff1f2', border: 'fecdd3', c: C.red },
  ];
  thresh.forEach((t, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 2.1 + i * 0.85, w: 5.9, h: 0.72, rectRadius: 0.1, fill: { color: t.fill }, line: { color: t.border, pt: 1 } });
    s.addText(t.v, { x: 0.5, y: 2.2 + i * 0.85, w: 5.5, h: 0.28, fontSize: 12, bold: true, color: t.c, fontFace: 'Calibri' });
    s.addText(t.sub, { x: 0.5, y: 2.5 + i * 0.85, w: 5.5, h: 0.24, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  addCard(s, [
    { text: 'Sensor Profiles', bold: true, size: 11 },
    { text: 'Normal (55%): 8–36 ppm baseline', size: 9, color: C.navy3 },
    { text: 'Elevated (25%): 38–60 ppm during working hours', size: 9, color: C.navy3 },
    { text: 'Spiking (20%): 62–92 ppm at peak hours (09:00, 14:00, 20:00)', size: 9, color: C.navy3 },
  ], { x: 0.3, y: 3.9, w: 5.9, h: 1.1 });

  addCard(s, [
    { text: 'Smart Deduplication', bold: true, size: 11, color: C.blue2 },
    { text: '15-minute window: repeated breach events from the same sensor are suppressed to prevent alert flooding.', size: 9, color: C.blue2 },
  ], { x: 0.3, y: 5.1, w: 5.9, h: 0.85, fill: C.blueB, border: 'bae6fd' });

  // Simulated line chart area
  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: '0f172a' }, line: { color: '1e293b', pt: 1 } });
  s.addText('24h Gas Trend — All Sensors (ppm)', { x: 6.8, y: 1.55, w: 6.0, h: 0.3, fontSize: 10, bold: true, color: C.slate2, fontFace: 'Calibri' });
  s.addText('[Line chart: one colored line per sensor\nshowing hourly PPM over 24 hours with\nwarning (amber dashed) and critical (red\ndashed) reference lines at 50 and 80 ppm]', { x: 6.8, y: 2.2, w: 6.0, h: 4.0, fontSize: 11, color: C.slate, fontFace: 'Calibri', italic: true });
}

// ── 10. 3D MAP ───────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Map');
  addAccentBar(s);
  addH1(s, 'Interactive 3D satellite map', { y: 0.76, h: 0.5 });

  s.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 1.45, w: 6.0, h: 5.65, rectRadius: 0.12, fill: { color: '0d1a2a' }, line: { color: '1e3a5f', pt: 1 } });
  s.addText('Mapbox GL 3D Satellite View\n\nColor-coded device pins — green (normal), amber (warning), red (critical), blue (gateway).\n\nClick any pin for device details. Drag to reposition. Toggle between 2D and 3D perspective.', { x: 0.5, y: 2.8, w: 5.5, h: 3.0, fontSize: 11, color: C.slate2, fontFace: 'Calibri', italic: true, align: 'center' });

  const capList = [
    'Mapbox GL satellite terrain in 3D perspective',
    '2D / 3D toggle for operational preference',
    'Color-coded pins: green (OK), amber (warning), red (critical)',
    'Click any pin to see device name, RU, PPM, health score',
    'Drag to reposition device location (persisted to DB)',
  ];
  addCard(s, [{ text: 'Map Capabilities', bold: true, size: 11 }], { x: 6.6, y: 1.4, w: 6.5, h: 0.45 });
  capList.forEach((c, i) => {
    s.addText('✓  ' + c, { x: 6.8, y: 1.95 + i * 0.5, w: 6.1, h: 0.4, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  const pins = [
    { c: C.green, l: 'Green — Normal (PPM below warning)' },
    { c: C.amber, l: 'Amber — Warning (≥50 ppm)' },
    { c: C.red, l: 'Red — Critical (≥80 ppm)' },
    { c: '3b82f6', l: 'Blue — Gateway node' },
  ];
  addCard(s, [{ text: 'Pin Color Meaning', bold: true, size: 11 }], { x: 6.6, y: 4.35, w: 6.5, h: 0.45 });
  pins.forEach((p, i) => {
    s.addShape(prs.ShapeType.ellipse, { x: 6.8, y: 4.9 + i * 0.46, w: 0.16, h: 0.16, fill: { color: p.c }, line: { color: p.c } });
    s.addText(p.l, { x: 7.05, y: 4.88 + i * 0.46, w: 5.8, h: 0.3, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });
}

// ── 11. DEVICE MANAGEMENT ────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Devices');
  addAccentBar(s);
  addH1(s, 'Device fleet management', { y: 0.76, h: 0.5 });

  addBody(s, 'A complete table view of all 57 devices — sensors, cluster heads, and gateways — with real-time health scores, battery metrics, and network quality grades.', { x: 0.3, y: 1.45, w: 6.0, h: 0.55, size: 10 });

  const metrics = [
    { t: 'Health Score (0–100)', b: 'Composite of battery, signal, and reading recency.' },
    { t: 'Battery', b: 'Voltage, state of charge (SOC %), estimated remaining hours.' },
    { t: 'Network', b: 'RSSI, mesh/star RSSI, hops to gateway, quality grade A–D.' },
    { t: 'Latest PPM', b: 'Most recent gas reading per sensor node.' },
  ];
  addCard(s, [{ text: 'Per-Device Metrics', bold: true, size: 11 }], { x: 0.3, y: 2.1, w: 5.9, h: 0.42 });
  metrics.forEach((m, i) => {
    s.addText(m.t + ': ' + m.b, { x: 0.5, y: 2.62 + i * 0.4, w: 5.6, h: 0.36, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  const ops = ['Search and filter by name, RU, or device type', 'Inline rename device (persisted to database)', 'Drag device pin to update location on map', 'Filter by type: Gateway / Cluster Head / Sensor'];
  addCard(s, [{ text: 'Operations', bold: true, size: 11 }], { x: 0.3, y: 4.3, w: 5.9, h: 0.42 });
  ops.forEach((o, i) => s.addText('✓  ' + o, { x: 0.5, y: 4.82 + i * 0.4, w: 5.6, h: 0.36, fontSize: 9, color: C.navy3, fontFace: 'Calibri' }));

  // Sample table
  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('Sample Device Table', { x: 6.8, y: 1.5, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  const cols = ['Device', 'Health', 'Battery', 'Net'];
  cols.forEach((c, i) => s.addText(c, { x: 6.8 + i * 1.6, y: 1.9, w: 1.5, h: 0.25, fontSize: 8, bold: true, color: C.slate, fontFace: 'Calibri' }));

  const drows = [
    { n: 'RU2 Sensor 1', h: '87', hc: C.green, b: '76% · 3.7V', net: 'B', nc: C.blue, fill: C.white },
    { n: 'RU7 Sensor 3', h: '54', hc: C.amber, b: '61% · 3.5V', net: 'C', nc: C.amber, fill: 'fffbeb' },
    { n: 'RU2 Gateway 1', h: '99', hc: C.green, b: '100% · 12V', net: 'A', nc: C.green, fill: C.white },
    { n: 'RU5 Sensor 1', h: '72', hc: C.blue, b: '68% · 3.6V', net: 'B', nc: C.blue, fill: C.white },
  ];
  drows.forEach((r, i) => {
    s.addShape(prs.ShapeType.rect, { x: 6.8, y: 2.22 + i * 0.88, w: 6.1, h: 0.8, fill: { color: r.fill }, line: { color: C.border, pt: 1 } });
    s.addText(r.n, { x: 6.8, y: 2.35 + i * 0.88, w: 1.55, h: 0.3, fontSize: 9, bold: true, color: C.navy, fontFace: 'Calibri' });
    s.addText(r.h, { x: 8.4, y: 2.35 + i * 0.88, w: 1.5, h: 0.3, fontSize: 9, bold: true, color: r.hc, fontFace: 'Calibri' });
    s.addText(r.b, { x: 10.0, y: 2.35 + i * 0.88, w: 1.5, h: 0.3, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
    s.addText(r.net, { x: 11.6, y: 2.35 + i * 0.88, w: 1.0, h: 0.3, fontSize: 9, bold: true, color: r.nc, fontFace: 'Calibri' });
  });
}

// ── 12. ALERT SYSTEM ─────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Alerts');
  addAccentBar(s);
  addH1(s, 'Intelligent alert system', { y: 0.76, h: 0.5 });

  addBody(s, 'Alerts generated when sensors breach thresholds or devices change status. 15-minute deduplication window prevents flood alerts from the same sensor.', { x: 0.3, y: 1.45, w: 6.0, h: 0.55, size: 10 });

  const alerts = [
    { sev: 'CRITICAL', type: 'THRESHOLD_BREACH', body: '≥80 ppm — immediate escalation', fill: 'fff1f2', border: 'fecdd3', sc: C.red },
    { sev: 'WARNING', type: 'THRESHOLD_BREACH', body: '≥50 ppm — operator attention needed', fill: 'fffbeb', border: 'fde68a', sc: C.amber },
    { sev: 'WARNING', type: 'DEVICE_OFFLINE', body: 'Sensor lost connection', fill: 'fffbeb', border: 'fde68a', sc: C.amber },
  ];
  alerts.forEach((a, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 2.1 + i * 0.88, w: 5.9, h: 0.76, rectRadius: 0.08, fill: { color: a.fill }, line: { color: a.border, pt: 1 } });
    s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: 2.2 + i * 0.88, w: 0.75, h: 0.2, rectRadius: 0.1, fill: { color: a.sc } });
    s.addText(a.sev, { x: 0.4, y: 2.22 + i * 0.88, w: 0.75, h: 0.16, fontSize: 6.5, bold: true, color: C.white, align: 'center', fontFace: 'Calibri' });
    s.addText(a.type, { x: 1.25, y: 2.2 + i * 0.88, w: 4.8, h: 0.22, fontSize: 10, bold: true, color: C.navy, fontFace: 'Calibri' });
    s.addText(a.body, { x: 1.25, y: 2.44 + i * 0.88, w: 4.8, h: 0.28, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  const feats = ['Filterable by severity, type, and status (active/resolved)', 'Search by message, device name, or RU', 'Displays affected device, RU, exact timestamp', 'One-click jump to device on map', 'Badge in sidebar always shows global unacknowledged count'];
  addCard(s, [{ text: 'Alert Panel Features', bold: true, size: 11 }], { x: 0.3, y: 4.8, w: 5.9, h: 0.42 });
  feats.forEach((f, i) => s.addText('✓  ' + f, { x: 0.5, y: 5.3 + i * 0.38, w: 5.6, h: 0.34, fontSize: 9, color: C.navy3, fontFace: 'Calibri' }));

  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.blueB }, line: { color: C.blueB2, pt: 1 } });
  s.addText('Smart Deduplication', { x: 6.8, y: 1.5, w: 6.0, h: 0.35, fontSize: 14, bold: true, color: C.blue2, fontFace: 'Calibri' });
  s.addText('When a sensor is continuously breaching threshold, only one event is logged per 15-minute window — keeping the alert queue actionable, not overwhelming.\n\nWithout deduplication, a single spiking sensor could generate hundreds of identical events per hour, burying real distinct incidents in noise.\n\nThe 15-minute window strikes a balance: responsive enough to catch actual new incidents, tolerant enough to filter sustained single-source events.', { x: 6.8, y: 2.0, w: 6.0, h: 4.5, fontSize: 11, color: C.blue2, fontFace: 'Calibri', wrap: true });
}

// ── 13. EVENT LOG ─────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Event Log');
  addAccentBar(s);
  addH1(s, 'Complete event log &\noperator acknowledgement', { y: 0.76, h: 0.7 });

  addBody(s, 'Every system event is recorded with full context — who, what, when, where. Operators must provide a documented reason when acknowledging alerts.', { x: 0.3, y: 1.55, w: 6.0, h: 0.55, size: 10 });

  const events = [
    { type: 'THRESHOLD_BREACH', sev: 'CRIT', tc: C.red, msg: 'RU7 Sensor 3 — 91.2 ppm exceeds CRITICAL', ts: '2026-06-06 22:13:04' },
    { type: 'ACK', sev: 'INFO', tc: C.blue, msg: 'Acknowledged by admin@gld.com — valve adjusted', ts: '2026-06-06 19:55:12' },
    { type: 'DEVICE_OFFLINE', sev: 'WARN', tc: C.amber, msg: 'RU5 Sensor 1 changed status: ONLINE → OFFLINE', ts: '2026-06-06 12:02:40' },
    { type: 'LOGIN', sev: 'INFO', tc: '7c3aed', msg: 'Operator admin@gld.com signed in', ts: '2026-06-06 06:02:34' },
  ];
  s.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 2.2, w: 5.9, h: events.length * 0.78 + 0.45, rectRadius: 0.1, fill: { color: '0f172a' }, line: { color: '1e293b', pt: 1 } });
  events.forEach((e, i) => {
    const y = 2.5 + i * 0.78;
    s.addShape(prs.ShapeType.roundRect, { x: 0.45, y: y + 0.02, w: 1.3, h: 0.2, rectRadius: 0.1, fill: { color: e.tc } });
    s.addText(e.type.replace('_', '\n'), { x: 0.45, y: y + 0.04, w: 1.3, h: 0.18, fontSize: 5.5, bold: true, color: C.white, align: 'center', fontFace: 'Calibri' });
    s.addText(e.sev, { x: 1.85, y: y + 0.05, w: 0.5, h: 0.16, fontSize: 7, color: e.tc, bold: true, fontFace: 'Calibri' });
    s.addText(e.msg, { x: 2.4, y: y + 0.03, w: 3.5, h: 0.28, fontSize: 8.5, color: 'e2e8f0', fontFace: 'Calibri' });
    s.addText(e.ts, { x: 0.45, y: y + 0.35, w: 5.4, h: 0.2, fontSize: 7.5, color: '475569', fontFace: 'Courier New' });
  });

  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('Event Types Logged', { x: 6.8, y: 1.5, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  const types = [
    { t: 'THRESHOLD_BREACH', c: C.red }, { t: 'DEVICE_OFFLINE', c: C.amber },
    { t: 'DEVICE_ONLINE', c: C.blue }, { t: 'LOGIN / LOGOUT', c: '7c3aed' },
    { t: 'ACK', c: C.green },
  ];
  types.forEach((t, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 6.8 + (i % 2) * 3.1, y: 1.92 + Math.floor(i / 2) * 0.5, w: 2.9, h: 0.35, rectRadius: 0.1, fill: { color: t.c } });
    s.addText(t.t, { x: 6.9 + (i % 2) * 3.1, y: 1.97 + Math.floor(i / 2) * 0.5, w: 2.7, h: 0.25, fontSize: 8, bold: true, color: C.white, fontFace: 'Calibri', align: 'center' });
  });

  s.addText('Acknowledgement Workflow', { x: 6.8, y: 3.45, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  const ackSteps = ['Only unacknowledged events can be acked', 'Mandatory operator note (required field)', 'ACK event auto-created in the log', 'Record shows: who acked, when, and their note'];
  ackSteps.forEach((a, i) => s.addText('✓  ' + a, { x: 6.8, y: 3.85 + i * 0.46, w: 6.1, h: 0.38, fontSize: 9, color: C.navy3, fontFace: 'Calibri' }));

  addCard(s, [{ text: 'Full-text search across messages, RU, and operator email. Filter by event type, severity, and acknowledgement status.', size: 9, color: C.blue2 }], { x: 6.6, y: 5.85, w: 6.5, h: 0.65, fill: C.blueB, border: C.blueB2 });
}

// ── 14. COMPLIANCE EXPORT ─────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Reporting');
  addAccentBar(s);
  addH1(s, 'Audit & compliance export', { y: 0.76, h: 0.5 });

  addBody(s, 'One-click export of the full event log — designed to satisfy audit requirements, regulatory inspections, and root cause analysis (RCA) workflows.', { x: 0.3, y: 1.45, w: 12.5, h: 0.55, size: 10 });

  [
    { icon: '📊', t: 'CSV Export', b: 'Machine-readable. All columns: timestamp, type, severity, RU, message, ack status, operator note. Compatible with Excel, Python, R.', fill: C.bg, border: C.border },
    { icon: '📄', t: 'PDF Report', b: 'Styled audit report with summary stats, event type breakdown, full event table, and RESTRICTED footer. Printable and archiveable.', fill: C.blueB, border: C.blueB2 },
  ].forEach((e, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + i * 6.4, y: 2.15, w: 6.1, h: 2.2, rectRadius: 0.14, fill: { color: e.fill }, line: { color: e.border, pt: 1 } });
    s.addText(e.icon, { x: 0.4 + i * 6.4, y: 2.3, w: 6.0, h: 0.5, fontSize: 24, align: 'center' });
    s.addText(e.t, { x: 0.4 + i * 6.4, y: 2.85, w: 6.0, h: 0.35, fontSize: 14, bold: true, color: i === 1 ? C.blue2 : C.navy, align: 'center', fontFace: 'Calibri' });
    s.addText(e.b, { x: 0.5 + i * 6.4, y: 3.25, w: 5.8, h: 0.9, fontSize: 9, color: i === 1 ? C.blue2 : C.navy3, align: 'center', fontFace: 'Calibri', wrap: true });
  });

  const contents = ['Export scope: all events or filtered view (by RU, type, ack status)', 'Header: operator email, site (RU), generation timestamp', 'Summary stats: total events, unacknowledged count, event type breakdown', 'Full event table with all fields', 'PDF footer: "RESTRICTED — AUDIT USE ONLY"'];
  s.addText('Report Contents', { x: 0.3, y: 4.55, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  contents.forEach((c, i) => s.addText('✓  ' + c, { x: 0.3, y: 4.95 + i * 0.39, w: 5.9, h: 0.35, fontSize: 9, color: C.navy3, fontFace: 'Calibri' }));

  const uses = ['HSE Audit', 'Incident RCA', 'Regulatory Inspection', 'Shift Handover', 'Insurance Claims'];
  s.addText('Use Cases', { x: 6.7, y: 4.55, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  uses.forEach((u, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 6.7 + (i % 2) * 3.1, y: 4.95 + Math.floor(i / 2) * 0.55, w: 2.9, h: 0.4, rectRadius: 0.08, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    s.addText(u, { x: 6.8 + (i % 2) * 3.1, y: 5.0 + Math.floor(i / 2) * 0.55, w: 2.7, h: 0.3, fontSize: 10, color: C.navy3, align: 'center', fontFace: 'Calibri' });
  });
}

// ── 15. ANALYTICS ────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Analytics');
  addAccentBar(s);
  addH1(s, 'Gas analytics dashboard', { y: 0.76, h: 0.5 });

  addBody(s, 'Rich historical analytics built from real sensor data. 24H / 7D toggle switches all charts simultaneously. Responds to the active RU filter.', { x: 0.3, y: 1.45, w: 6.0, h: 0.55, size: 10 });

  const sections = [
    { t: 'Gas Trend', b: 'Avg PPM area chart with warning and critical reference lines. Shows concentration pattern over time.' },
    { t: 'Breach Count', b: 'Bar chart of threshold violations per period. Highlights peak incident hours or days.' },
    { t: 'RU Comparison', b: 'Horizontal bars — avg PPM and breach count per refinery unit. Identify high-risk sites.' },
    { t: 'Heatmap', b: 'Hour-of-day × RU grid. Spot peak risk windows — when and where gas levels are highest.' },
    { t: 'Top Risky Sensors', b: 'Ranked table by avg PPM. Direct list of devices requiring attention or inspection.' },
    { t: 'Fleet Health', b: 'Online/offline counts, battery distribution bars, network quality grade tiles (A/B/C/D).' },
  ];
  sections.forEach((sec, i) => {
    const row = Math.floor(i / 2), col = i % 2;
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + col * 3.05, y: 2.1 + row * 1.55, w: 2.9, h: 1.4, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    s.addText(sec.t, { x: 0.45 + col * 3.05, y: 2.22 + row * 1.55, w: 2.65, h: 0.28, fontSize: 11, bold: true, color: C.navy, fontFace: 'Calibri' });
    s.addText(sec.b, { x: 0.45 + col * 3.05, y: 2.54 + row * 1.55, w: 2.65, h: 0.8, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });
  });

  addCard(s, [
    { text: '24H / 7D Toggle', bold: true, size: 11, color: C.blue2 },
    { text: 'Refetches data from backend — trend charts, breach counts, RU comparison, and top sensors all update. Heatmap always uses 7-day window for pattern detection.', size: 9, color: C.blue2 },
  ], { x: 0.3, y: 6.8, w: 6.0, h: 0.85, fill: C.blueB, border: C.blueB2 });

  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('Hour-of-Day × RU Heatmap', { x: 6.8, y: 1.5, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  s.addText('Each cell shows average PPM for that hour across 7 days. Blue = low, amber = warning zone, red = critical.', { x: 6.8, y: 1.85, w: 6.0, h: 0.55, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });

  const heatRUs = ['RU2', 'RU3', 'RU4', 'RU5', 'RU6', 'RU7'];
  const heatData = [
    [10,10,8,15,35,40,40,70,40,38,40,38],
    [8,8,7,10,18,20,20,35,22,20,32,12],
    [5,5,5,8,10,12,12,14,13,12,12,8],
    [8,8,7,10,12,14,14,18,15,14,15,10],
    [10,10,8,15,25,30,30,60,32,28,35,12],
    [12,11,10,20,55,60,58,75,60,50,65,14],
  ];
  const ruColors = ['38bdf8','34d399','f59e0b','a78bfa','fb7185','22d3ee'];
  heatRUs.forEach((ru, ri) => {
    s.addText(ru, { x: 6.8, y: 2.55 + ri * 0.52, w: 0.35, h: 0.3, fontSize: 8, bold: true, color: ruColors[ri], fontFace: 'Calibri' });
    heatData[ri].forEach((val, hi) => {
      const alpha = Math.min(0.9, val / 80);
      const fillC = val >= 70 ? 'ef4444' : val >= 40 ? 'f59e0b' : '38bdf8';
      const opacity = Math.max(0.1, alpha);
      s.addShape(prs.ShapeType.rect, { x: 7.2 + hi * 0.46, y: 2.57 + ri * 0.52, w: 0.4, h: 0.36, fill: { color: fillC, transparency: Math.round((1 - opacity) * 100) }, line: { color: 'e2e8f0', pt: 0.5 } });
    });
  });
}

// ── 16. MULTI-SITE ───────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Feature — Multi-Site');
  addAccentBar(s);
  addH1(s, 'Multi-site refinery management', { y: 0.76, h: 0.5 });

  addBody(s, 'Six refinery units — RU2 through RU7 — each with their own sensor density and risk profile. Switch between ALL-site and per-unit views in a single click.', { x: 0.3, y: 1.45, w: 12.5, h: 0.55, size: 10 });

  const rus = [
    { id: 'RU2', c: '38bdf8', sns: 10, note: 'Highest density' },
    { id: 'RU3', c: '34d399', sns: 4,  note: 'Elevated avg' },
    { id: 'RU4', c: 'f59e0b', sns: 3,  note: 'Normal range' },
    { id: 'RU5', c: 'a78bfa', sns: 2,  note: 'Device events' },
    { id: 'RU6', c: 'fb7185', sns: 4,  note: '2 gateways' },
    { id: 'RU7', c: '22d3ee', sns: 5,  note: 'High breaches' },
  ];
  rus.forEach((r, i) => {
    const x = 0.3 + (i % 3) * 2.15, y = 2.15 + Math.floor(i / 3) * 1.6;
    s.addShape(prs.ShapeType.roundRect, { x, y, w: 2.0, h: 1.4, rectRadius: 0.1, fill: { color: C.white }, line: { color: r.c, pt: 2 } });
    s.addText(r.id, { x, y: y + 0.18, w: 2.0, h: 0.36, fontSize: 18, bold: true, color: r.c, align: 'center', fontFace: 'Calibri' });
    s.addText(r.sns + ' sensors', { x, y: y + 0.57, w: 2.0, h: 0.25, fontSize: 9, color: C.slate, align: 'center', fontFace: 'Calibri' });
    s.addText(r.note, { x, y: y + 0.82, w: 2.0, h: 0.25, fontSize: 9, color: C.navy3, align: 'center', fontFace: 'Calibri' });
  });

  s.addShape(prs.ShapeType.roundRect, { x: 6.8, y: 1.35, w: 6.3, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('What responds to RU selection', { x: 7.0, y: 1.5, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  const scopeItems = ['KPI cards (devices, online %, battery, alerts)', 'Overview gas trend line chart', 'Refinery Unit Health panel', 'Health by Device Type panel', 'Device table and map pins', 'Event log query', 'Analytics (trend, top sensors, fleet health)'];
  scopeItems.forEach((item, i) => s.addText('✓  ' + item, { x: 7.0, y: 1.95 + i * 0.52, w: 5.9, h: 0.44, fontSize: 9, color: C.navy3, fontFace: 'Calibri' }));

  addCard(s, [
    { text: 'Global alert badge in the sidebar always shows the count across ALL sites — critical alerts are never missed even when viewing a specific unit.', size: 9, color: C.blue2 },
  ], { x: 6.8, y: 5.85, w: 6.3, h: 0.65, fill: C.blueB, border: C.blueB2 });
}

// ── 17. SECTION: TECHNICAL ───────────────────────────────────────────────────
{
  const s = prs.addSlide();
  sectionStyle(s);
  s.addShape(prs.ShapeType.roundRect, { x: 0.4, y: 0.5, w: 1.8, h: 0.28, rectRadius: 0.14, fill: { color: '1e3a5f' }, line: { color: '2d5a8e', pt: 1 } });
  s.addText('SECTION 03', { x: 0.4, y: 0.52, w: 1.8, h: 0.24, fontSize: 8, color: '93c5fd', bold: true, align: 'center', fontFace: 'Calibri' });
  s.addText('Technical Overview', { x: 0.4, y: 2.2, w: 10, h: 1.0, fontSize: 36, bold: true, color: C.white, fontFace: 'Calibri' });
  s.addText('Data flow, security model, deployment configuration, and the technology stack in detail.', { x: 0.4, y: 3.3, w: 9, h: 0.6, fontSize: 14, color: C.slate2, fontFace: 'Calibri' });
  s.addText('03', { x: 9.5, y: 4.5, w: 3.5, h: 2.5, fontSize: 100, bold: true, color: '1e293b', fontFace: 'Calibri', align: 'right' });
}

// ── 18. DATA FLOW ─────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Technical — Data Flow');
  addAccentBar(s);
  addH1(s, 'End-to-end data flow', { y: 0.76, h: 0.5 });

  const flow = [
    { icon: '🔵', t: 'Gas Sensor', b: 'MQ-series · 20s' },
    { icon: '📡', t: 'Cluster Head', b: 'Star topology' },
    { icon: '🛜', t: 'Gateway', b: 'Mesh root' },
    { icon: '🖥', t: 'NestJS API', b: 'GraphQL · 4000' },
    { icon: '💾', t: 'Prisma/SQLite', b: 'Persist & query' },
    { icon: '⚛', t: 'Next.js UI', b: 'Render · 3000' },
  ];

  flow.forEach((f, i) => {
    const x = 0.3 + i * 2.15;
    s.addShape(prs.ShapeType.roundRect, { x, y: 1.45, w: 1.9, h: 1.2, rectRadius: 0.1, fill: { color: i >= 3 ? C.blueB : C.bg }, line: { color: i >= 3 ? C.blueB2 : C.border, pt: 1 } });
    s.addText(f.icon, { x, y: 1.52, w: 1.9, h: 0.35, fontSize: 18, align: 'center' });
    s.addText(f.t, { x, y: 1.9, w: 1.9, h: 0.25, fontSize: 10, bold: true, color: C.navy, align: 'center', fontFace: 'Calibri' });
    s.addText(f.b, { x, y: 2.15, w: 1.9, h: 0.22, fontSize: 8, color: C.slate, align: 'center', fontFace: 'Calibri' });
    if (i < flow.length - 1) {
      s.addText('→', { x: x + 1.9, y: 1.9, w: 0.25, h: 0.26, fontSize: 16, color: C.blue, align: 'center', fontFace: 'Calibri' });
    }
  });

  const flowCards = [
    { t: 'Backend Processing', items: ['PPM reading stored in Prisma/SQLite', 'Threshold check → EventLog entry', '15-minute deduplication for breach events', 'Device status change → OFFLINE/ONLINE event'] },
    { t: 'Frontend Polling', items: ['Next.js polls GraphQL every 20 seconds', 'Devices, stats, sensor timeline fetched', 'State diffed — device status change triggers event', 'Event log and analytics fetched on-demand'] },
    { t: 'GraphQL Schema', items: ['Code-first with @nestjs/graphql decorators', 'Queries: devices, stats, eventLogs, analytics', 'Mutations: login, createEventLog, acknowledgeEvent', 'Type-safe end-to-end with graphql-request'] },
  ];

  flowCards.forEach((fc, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + i * 4.35, y: 3.0, w: 4.15, h: 4.1, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    s.addText(fc.t, { x: 0.5 + i * 4.35, y: 3.15, w: 3.75, h: 0.3, fontSize: 11, bold: true, color: C.navy, fontFace: 'Calibri' });
    fc.items.forEach((it, ii) => s.addText('—  ' + it, { x: 0.5 + i * 4.35, y: 3.55 + ii * 0.52, w: 3.75, h: 0.46, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true }));
  });
}

// ── 19. TECH STACK ────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Technical — Stack');
  addAccentBar(s);
  addH1(s, 'Technology stack', { y: 0.76, h: 0.5 });

  const stack = [
    { tag: 'FRONTEND', items: ['Next.js 15 — App Router, React 18', 'TypeScript — strict end-to-end types', 'Recharts — AreaChart, BarChart, LineChart', 'Mapbox GL — react-map-gl, 3D satellite', 'graphql-request — lightweight GQL client', 'Lucide React — icon system', 'DM Sans + Geist Mono — typography'] },
    { tag: 'BACKEND', items: ['NestJS — modular Node.js framework', 'GraphQL — code-first with decorators', 'Prisma ORM — type-safe DB client', 'SQLite — zero-config, upgradeable', 'class-validator — input validation', 'TypeScript — strict mode'] },
    { tag: 'INFRA', items: ['Monorepo — apps/backend + apps/frontend', 'npm workspaces — shared dependencies', 'npm-run-all — parallel dev start', 'Prisma CLI — schema migrations', 'Seed script — 28 sensors × 7 days demo data', 'Port 3000 (UI) · Port 4000 (API)'] },
  ];

  stack.forEach((st, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + i * 4.35, y: 1.35, w: 4.15, h: 0.3, rectRadius: 0.1, fill: { color: C.blueB2 }, line: { color: C.blue, pt: 1 } });
    s.addText(st.tag, { x: 0.4 + i * 4.35, y: 1.38, w: 3.95, h: 0.24, fontSize: 8, bold: true, color: C.blue2, align: 'center', fontFace: 'Calibri' });
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + i * 4.35, y: 1.7, w: 4.15, h: 5.4, rectRadius: 0.1, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    st.items.forEach((it, ii) => s.addText('—  ' + it, { x: 0.5 + i * 4.35, y: 1.85 + ii * 0.65, w: 3.75, h: 0.55, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true }));
  });
}

// ── 20. SECURITY ──────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Technical — Security');
  addAccentBar(s);
  addH1(s, 'Security & access control', { y: 0.76, h: 0.5 });

  const roles = [
    { r: 'ADMIN', b: 'Full access to all RUs. Manage users, configure thresholds, view all events across all sites.', fill: C.blueB, border: C.blueB2, c: C.blue2 },
    { r: 'OPERATOR', b: 'Scoped to their assigned RU. View devices, acknowledge events, export reports for their unit only.', fill: C.bg, border: C.border, c: C.navy },
  ];
  s.addText('Role-Based Access', { x: 0.3, y: 1.45, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  roles.forEach((r, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 0.3, y: 1.82 + i * 1.0, w: 5.9, h: 0.85, rectRadius: 0.1, fill: { color: r.fill }, line: { color: r.border, pt: 1 } });
    s.addText(r.r, { x: 0.5, y: 1.92 + i * 1.0, w: 5.5, h: 0.25, fontSize: 11, bold: true, color: r.c, fontFace: 'Calibri' });
    s.addText(r.b, { x: 0.5, y: 2.18 + i * 1.0, w: 5.5, h: 0.36, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });
  });

  const rateLimit = [{ t: 'Rate Limiting', items: ['Max 5 login attempts per account', '15-minute lockout window', 'In-memory rate limit map per email'] }];
  s.addText('Rate Limiting', { x: 0.3, y: 3.9, w: 5.9, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  ['Max 5 login attempts per account', '15-minute lockout window', 'In-memory rate limit map per email'].forEach((it, i) => {
    s.addText('—  ' + it, { x: 0.3, y: 4.3 + i * 0.45, w: 5.9, h: 0.4, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  s.addShape(prs.ShapeType.roundRect, { x: 6.6, y: 1.35, w: 6.5, h: 5.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
  s.addText('Audit Trail', { x: 6.8, y: 1.5, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  ['Every login/logout recorded with timestamp and operator email', 'All alert acknowledgements stored with mandatory operator note', 'Device state changes automatically logged', 'Complete chain from first detection → acknowledgement → resolution'].forEach((it, i) => {
    s.addText('✓  ' + it, { x: 6.8, y: 1.9 + i * 0.52, w: 6.1, h: 0.44, fontSize: 9, color: C.navy3, fontFace: 'Calibri', wrap: true });
  });

  s.addText('Data Integrity', { x: 6.8, y: 4.05, w: 6.0, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
  ['GraphQL input validation via class-validator', 'Prisma type-safe queries — no raw SQL injection risk', 'Acknowledgement notes validated non-empty before save'].forEach((it, i) => {
    s.addText('✓  ' + it, { x: 6.8, y: 4.45 + i * 0.5, w: 6.1, h: 0.42, fontSize: 9, color: C.navy3, fontFace: 'Calibri' });
  });

  addCard(s, [{ text: 'Dev mode: passwordless login for demonstration. Production mode adds bcrypt password hashing and session management.', size: 9, color: C.blue2 }], { x: 6.6, y: 5.95, w: 6.5, h: 0.65, fill: C.blueB, border: C.blueB2 });
}

// ── 21. LIVE METRICS ──────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'System Metrics');
  addAccentBar(s);
  addH1(s, 'Live system metrics', { y: 0.76, h: 0.5 });

  const stats = [
    { n: '28', l: 'Gas Sensors', c: C.blue }, { n: '57', l: 'Total Devices', c: C.green },
    { n: '6', l: 'Refinery Units', c: '7c3aed' }, { n: '4,704', l: 'Readings / 7 Days', c: C.blue },
    { n: '20s', l: 'Refresh Interval', c: C.amber }, { n: '15min', l: 'Alert Dedup Window', c: C.red },
    { n: '6', l: 'Event Types Logged', c: C.green }, { n: '2', l: 'Export Formats (CSV+PDF)', c: C.blue },
  ];

  stats.forEach((st, i) => {
    const row = Math.floor(i / 4), col = i % 4;
    s.addShape(prs.ShapeType.roundRect, { x: 0.3 + col * 3.2, y: 1.5 + row * 2.0, w: 3.0, h: 1.75, rectRadius: 0.12, fill: { color: C.bg }, line: { color: C.border, pt: 1 } });
    s.addText(st.n, { x: 0.3 + col * 3.2, y: 1.7 + row * 2.0, w: 3.0, h: 0.85, fontSize: 32, bold: true, color: st.c, align: 'center', fontFace: 'Calibri' });
    s.addText(st.l.toUpperCase(), { x: 0.3 + col * 3.2, y: 2.58 + row * 2.0, w: 3.0, h: 0.3, fontSize: 8, color: C.slate, align: 'center', fontFace: 'Calibri' });
  });
}

// ── 22. ROADMAP ───────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  addTag(s, 'Roadmap');
  addAccentBar(s);
  addH1(s, 'Next steps & roadmap', { y: 0.76, h: 0.5 });

  const phases = [
    { p: 'Phase 2', t: 'Hardware Integration', c: C.blue, items: ['Real device SDK integration (MQTT / LoRaWAN)', 'OTA firmware update distribution', 'Calibration record management'] },
    { p: 'Phase 3', t: 'Mobile & Notifications', c: '7c3aed', items: ['React Native mobile app for field operators', 'Push notifications for critical alerts', 'Offline-capable sensor readings cache'] },
    { p: 'Phase 4', t: 'AI & Predictive Safety', c: C.amber, items: ['ML anomaly detection — pre-threshold patterns', 'Predictive maintenance from battery decay', 'Cross-site correlation analysis'] },
    { p: 'Phase 5', t: 'Cloud & Compliance', c: C.green, items: ['PostgreSQL + cloud deployment (AWS / GCP)', 'HSE / ATEX compliance framework', 'Multi-tenant SaaS with billing'] },
  ];

  phases.forEach((ph, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.3 + col * 6.4, y = 1.5 + row * 2.7;
    s.addShape(prs.ShapeType.roundRect, { x, y, w: 6.1, h: 2.5, rectRadius: 0.1, fill: { color: C.bg }, line: { color: ph.c, pt: 2 } });
    s.addShape(prs.ShapeType.roundRect, { x: x + 0.15, y: y + 0.14, w: 1.0, h: 0.24, rectRadius: 0.12, fill: { color: ph.c } });
    s.addText(ph.p, { x: x + 0.15, y: y + 0.16, w: 1.0, h: 0.2, fontSize: 8, bold: true, color: C.white, align: 'center', fontFace: 'Calibri' });
    s.addText(ph.t, { x: x + 1.25, y: y + 0.14, w: 4.7, h: 0.3, fontSize: 12, bold: true, color: C.navy, fontFace: 'Calibri' });
    ph.items.forEach((it, ii) => s.addText('—  ' + it, { x: x + 0.2, y: y + 0.6 + ii * 0.56, w: 5.7, h: 0.5, fontSize: 9.5, color: C.navy3, fontFace: 'Calibri' }));
  });
}

// ── 23. THANK YOU ─────────────────────────────────────────────────────────────
{
  const s = prs.addSlide();
  titleSlideStyle(s);

  s.addText('Thank You', { x: 0.5, y: 2.2, w: 12.33, h: 1.2, fontSize: 52, bold: true, color: C.white, align: 'center', fontFace: 'Calibri' });
  s.addText('GASGUARD v2.1 — Intelligent Gas Leak Detection & Monitoring System', { x: 1, y: 3.55, w: 11.33, h: 0.5, fontSize: 16, color: C.slate2, align: 'center', fontFace: 'Calibri' });

  const contacts = [
    { l: 'Contact', v: 'ravellerhaven@gmail.com', c: C.slate2 },
    { l: 'Dashboard', v: 'localhost:3000', c: '38bdf8' },
    { l: 'GraphQL API', v: 'localhost:4000/graphql', c: '38bdf8' },
  ];

  contacts.forEach((ct, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 1.8 + i * 3.3, y: 4.4, w: 3.0, h: 1.05, rectRadius: 0.1, fill: { color: '1e293b' }, line: { color: '334155', pt: 1 } });
    s.addText(ct.l.toUpperCase(), { x: 1.8 + i * 3.3, y: 4.52, w: 3.0, h: 0.22, fontSize: 8, color: '475569', bold: true, align: 'center', charSpacing: 1, fontFace: 'Calibri' });
    s.addText(ct.v, { x: 1.8 + i * 3.3, y: 4.76, w: 3.0, h: 0.3, fontSize: 11, color: ct.c, align: 'center', fontFace: 'Calibri' });
  });

  const tags = ['NestJS + GraphQL', 'Next.js 15', 'Mapbox 3D', 'Prisma + SQLite'];
  tags.forEach((t, i) => {
    s.addShape(prs.ShapeType.roundRect, { x: 2.1 + i * 2.35, y: 5.95, w: 2.15, h: 0.35, rectRadius: 0.17, fill: { color: '1e293b' }, line: { color: '334155', pt: 1 } });
    s.addText(t, { x: 2.1 + i * 2.35, y: 5.99, w: 2.15, h: 0.27, fontSize: 8.5, color: C.slate2, align: 'center', fontFace: 'Calibri' });
  });

  s.addText('June 2026  ·  Confidential  ·  GASGUARD v2.1', { x: 0, y: 7.0, w: 13.33, h: 0.28, fontSize: 8, color: '334155', align: 'center', fontFace: 'Calibri' });
}

// ── Save ─────────────────────────────────────────────────────────────────────
prs.writeFile({ fileName: 'gasguard-v2.1.pptx' })
  .then(() => console.log('✓ gasguard-v2.1.pptx generated successfully'))
  .catch(e => console.error('✗ Error:', e));
