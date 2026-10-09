#!/usr/bin/env node
// Guards against the classic monorepo trap: a local @myrmidon/<lib> library
// resolving to a stale published npm copy under node_modules instead of the
// workspace's own dist/ build. Local libraries are wired through
// tsconfig.json's compilerOptions.paths -> ./dist/myrmidon/<lib>; if a real
// (non-symlinked) copy also exists under node_modules/@myrmidon, plain
// Node module resolution (used by anything that isn't compiled through the
// Angular/TS pipeline) can silently shadow the local source with outdated
// published code.
'use strict';

const fs = require('fs');
const path = require('path');

// tsconfig.json is JSONC: drop comments (outside strings) and trailing
// commas before parsing it.
function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) {
        if (text[i] === '\\') i++;
      }
      out += text.slice(start, i + 1);
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) break;
      i++;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const repoRoot = path.resolve(__dirname, '..');
const tsconfig = parseJsonc(
  fs.readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8')
);
const localLibs = Object.keys(tsconfig.compilerOptions.paths || {}).filter(
  (name) => name.startsWith('@myrmidon/')
);

let failed = false;

for (const name of localLibs) {
  const scopedName = name.slice('@myrmidon/'.length);
  const nodeModulesPath = path.join(
    repoRoot,
    'node_modules',
    '@myrmidon',
    scopedName
  );

  if (!fs.existsSync(nodeModulesPath)) {
    continue;
  }

  const stat = fs.lstatSync(nodeModulesPath);
  if (!stat.isSymbolicLink()) {
    console.error(
      `[check-local-libs] node_modules/@myrmidon/${scopedName} is a real ` +
        'directory, not a symlink. This means a published npm copy of a ' +
        'local workspace library exists and may shadow the local dist/ ' +
        'build. Remove it (e.g. pnpm remove, or delete the directory and ' +
        'reinstall) so resolution stays uniform via tsconfig paths.'
    );
    failed = true;
    continue;
  }

  const target = fs.realpathSync(nodeModulesPath);
  const expectedDist = path.join(repoRoot, 'dist', 'myrmidon', scopedName);
  if (path.resolve(target) !== path.resolve(expectedDist)) {
    console.error(
      `[check-local-libs] node_modules/@myrmidon/${scopedName} is a ` +
        `symlink, but points to ${target} instead of ${expectedDist}. ` +
        'Fix the link so it resolves into this workspace\'s own dist/ ' +
        'build.'
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
}

console.log(
  `[check-local-libs] OK: ${localLibs.length} local libraries resolve ` +
    'uniformly via tsconfig paths (no shadowing copies in node_modules).'
);
