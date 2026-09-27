#!/usr/bin/env node
/**
 * check-i18n-parity.mjs — dependency-free key-parity gate for the PawSpace messages.
 *
 * Flattens messages/th.json and messages/en.json into dotted key paths, prints the key
 * count of each, lists keys present in only one of the two files, and exits 1 when either
 * list is non-empty (so a TH/EN key mismatch fails the gate).
 *
 * Usage: node scripts/check-i18n-parity.mjs [thPath] [enPath]
 * Exit codes: 0 = parity OK, 1 = parity broken (th-only or en-only keys), 2 = usage/read error.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const thPath = process.argv[2] || path.join(repoRoot, 'messages', 'th.json');
const enPath = process.argv[3] || path.join(repoRoot, 'messages', 'en.json');

function readJson(file) {
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`FAIL: cannot read ${file}: ${error.message}`);
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`FAIL: ${file} is not valid JSON: ${error.message}`);
    process.exit(2);
  }
}

/** Flatten a nested object into sorted dotted key paths. */
function flatten(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const keys = [];
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === 'object' && !Array.isArray(child)) {
      keys.push(...flatten(child, next));
    } else {
      keys.push(next);
    }
  }
  return keys.sort();
}

const th = flatten(readJson(thPath));
const en = flatten(readJson(enPath));

const thSet = new Set(th);
const enSet = new Set(en);
const thOnly = th.filter((key) => !enSet.has(key));
const enOnly = en.filter((key) => !thSet.has(key));

console.log(`i18n key parity check`);
console.log(`  th: ${path.relative(repoRoot, thPath)} — ${th.length} keys`);
console.log(`  en: ${path.relative(repoRoot, enPath)} — ${en.length} keys`);

if (thOnly.length > 0) {
  console.log(`TH-only keys (${thOnly.length}):`);
  for (const key of thOnly) console.log(`  - ${key}`);
} else {
  console.log('TH-only keys (0): none');
}

if (enOnly.length > 0) {
  console.log(`EN-only keys (${enOnly.length}):`);
  for (const key of enOnly) console.log(`  - ${key}`);
} else {
  console.log('EN-only keys (0): none');
}

if (thOnly.length > 0 || enOnly.length > 0) {
  console.error(
    `FAIL: ${thOnly.length} th-only + ${enOnly.length} en-only keys — both languages must have identical keys.`,
  );
  process.exit(1);
}

console.log(`OK: ${th.length} keys in both languages, 0 missing in either direction.`);
process.exit(0);
