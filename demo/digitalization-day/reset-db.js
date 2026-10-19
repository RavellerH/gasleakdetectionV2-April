// Fresh RU4 demo database: migrations + clean RU4 register, no history.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backend = path.resolve(__dirname, '../../apps/backend');
const db = path.join(backend, 'prisma', 'dev.db');
for (const f of [db, `${db}-journal`]) if (fs.existsSync(f)) fs.rmSync(f);
const run = (cmd, env = {}) => execSync(cmd, { cwd: backend, stdio: 'inherit', env: { ...process.env, ...env } });
run('npx prisma migrate deploy');
run('node prisma/seed-ru4-cilacap.js ../../deploy/ru4/devices.ru4.example.json', {
  GLD_ADMIN_EMAIL: process.env.DEMO_ADMIN_EMAIL || 'demo@gld.local',
  GLD_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD || 'demo-gld-2026',
});
console.log('\nDatabase demo RU4 siap. Login: demo@gld.local / demo-gld-2026');
