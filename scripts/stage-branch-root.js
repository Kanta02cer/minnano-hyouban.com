#!/usr/bin/env node
'use strict';

// Pages currently publishes main/. Stage the validated dist snapshot there.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const manifestPath = path.join(root, '.published-root-files.json');
const retiredManifestPath = path.join(root, 'content/retired-public-files.json');
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
const retired = JSON.parse(fs.readFileSync(retiredManifestPath, 'utf8'));
if (!Array.isArray(retired) || retired.some(file => typeof file !== 'string') || new Set(retired).size !== retired.length) {
  throw new Error('Invalid retired-public-files manifest.');
}
const retiredAiPath = /^(?:ai-instruction\.json|ai-query-map\.json|aio-route-map\.json|aio-scores\.json|llms-full\.txt|llms\/articles\/\d{16}(?:\.txt|-(?:concept\.txt|ai-(?:instruction|patch)\.json)))$/;
for (const file of retired) {
  if (!retiredAiPath.test(file) || current.includes(file)) throw new Error(`Unsafe retired AI file path: ${file}`);
  const target = checkedPath(file);
  let ancestor = root;
  for (const part of file.split('/')) {
    ancestor = path.join(ancestor, part);
    if (fs.existsSync(ancestor) && fs.lstatSync(ancestor).isSymbolicLink()) {
      throw new Error(`Retired path contains a symlink: ${file}`);
    }
  }
  if (fs.existsSync(target) && (!fs.lstatSync(target).isFile() || fs.lstatSync(target).isSymbolicLink())) {
    throw new Error(`Retired path is not a regular file: ${file}`);
  }
}
for (const file of [...previous, ...current, ...retired]) checkedPath(file);

if (checkOnly) {
  for (const file of retired) {
    if (fs.existsSync(checkedPath(file))) throw new Error(`Retired AI file is still public: ${file}`);
  }
  if (JSON.stringify(previous) !== JSON.stringify(current)) throw new Error('Published file list differs from dist/.');
  for (const file of current) {
    const target = checkedPath(file);
    if (!fs.existsSync(target) || !fs.readFileSync(target).equals(fs.readFileSync(path.join(dist, file)))) {
      throw new Error(`Published file differs from dist/: ${file}`);
    }
  }
  console.log(`Branch-root snapshot verified (${current.length} files).`);
} else {
  // Delete only explicitly reviewed obsolete files, never legacy article folders.
  for (const file of retired) fs.rmSync(checkedPath(file), { force: true });
  for (const file of previous.filter(file => !current.includes(file))) fs.rmSync(checkedPath(file), { force: true });
  for (const file of current) {
    const target = checkedPath(file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(dist, file), target);
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`Branch-root snapshot staged (${current.length} files).`);
}
