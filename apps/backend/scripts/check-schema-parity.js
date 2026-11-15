#!/usr/bin/env node
// Fails when prisma/schema.prisma (SQLite, dev/demo) and
// prisma/mysql/schema.prisma (MySQL/MariaDB, RU site server) define
// different models. Only the datasource, generator output and @db.* column
// types may differ.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'prisma');
const normalize = (file) =>
  fs.readFileSync(file, 'utf8')
    .replace(/\/\/.*$/gm, '')                 // comments
    .replace(/datasource\s+db\s*\{[^}]*\}/, '') // provider / url
    .replace(/generator\s+client\s*\{[^}]*\}/, '') // output path
    .replace(/@db\.\w+(\([^)]*\))?/g, '')     // native column types
    .split('\n').map((l) => l.trim().replace(/\s+/g, ' ')).filter(Boolean);

const a = normalize(path.join(root, 'schema.prisma'));
const b = normalize(path.join(root, 'mysql', 'schema.prisma'));
const n = Math.max(a.length, b.length);
for (let i = 0; i < n; i++) {
  if (a[i] !== b[i]) {
    console.error('Prisma schemas differ (SQLite vs MySQL) at model line ' + (i + 1) + ':');
    console.error('  sqlite: ' + (a[i] ?? '<none>'));
    console.error('  mysql : ' + (b[i] ?? '<none>'));
    console.error('Update both prisma/schema.prisma and prisma/mysql/schema.prisma, then add a migration for each.');
    process.exit(1);
  }
}
console.log('Prisma schemas in sync (' + a.length + ' model lines).');
