#!/usr/bin/env node
'use strict';

// Pages currently publishes main/. Stage the validated dist snapshot there.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(root, '.published-root-files.json');
const checkOnly = process.argv.includes('--check');

function listFiles(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const relative = `${prefix}${entry.name}`;
    if (entry.isDirectory()) return listFiles(path.join(dir, entry.name), `${relative}/`);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Unsupported build entry: ${relative}`);
    return [relative];
  });
}

function checkedPath(relative) {
  if (!/^[A-Za-z0-9._/-]+$/.test(relative) || relative.startsWith('/') || relative.split('/').includes('..')) {
    throw new Error(`Invalid public path: ${relative}`);
  }
  return path.join(root, relative);
}

if (!fs.existsSync(dist)) throw new Error('dist/ is missing. Run npm run build first.');
const current = listFiles(dist).sort();
if (!current.includes('index.html') || !current.includes('CNAME') || !current.includes('sitemap.xml')) {
  throw new Error('dist/ does not contain the required site files.');
}
const previous = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : [];
if (!Array.isArray(previous) || previous.some(file => typeof file !== 'string')) {
  throw new Error('Invalid branch-root manifest.');
}
for (const file of [...previous, ...current]) checkedPath(file);

if (checkOnly) {
  if (JSON.stringify(previous) !== JSON.stringify(current)) throw new Error('Published file list differs from dist/.');
  for (const file of current) {
    const target = checkedPath(file);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(fs.readFileSync(path.join(dist, file)))) {
      throw new Error(`Published file differs from dist/: ${file}`);
    }
  }
  console.log(`Branch-root snapshot verified (${current.length} files).`);
} else {
  for (const file of previous.filter(file => !current.includes(file))) fs.rmSync(checkedPath(file), { force: true });
  for (const file of current) {
    const target = checkedPath(file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(dist, file), target);
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Branch-root snapshot staged (${current.length} files).`);
}
