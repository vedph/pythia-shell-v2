#!/usr/bin/env node
/**
 * Runs the Vitest unit tests of the libraries under projects/myrmidon.
 *
 * Library tests import their sibling libraries through tsconfig.json's
 * compilerOptions.paths -> ./dist/myrmidon/<name>, so run
 * `pnpm run build:libs` first whenever an upstream library changed.
 *
 * Usage:
 *   node scripts/test-libs.mjs             test all libraries
 *   node scripts/test-libs.mjs <name>...   test only these libraries
 *
 * Libraries without a test target in angular.json (e.g. those having only
 * type declarations) are skipped. All the requested libraries are tested
 * even when one fails; the exit code is nonzero if any failed.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NG = join(ROOT, 'node_modules', '@angular', 'cli', 'bin', 'ng.js');

const projects = JSON.parse(
  readFileSync(join(ROOT, 'angular.json'), 'utf8'),
).projects;
const local = Object.keys(projects)
  .filter(
    (name) =>
      name.startsWith('@myrmidon/') &&
      projects[name].projectType === 'library' &&
      projects[name].architect?.test,
  )
  .sort();

const requested = process.argv
  .slice(2)
  .map((r) => (r.startsWith('@myrmidon/') ? r : `@myrmidon/${r}`));
for (const name of requested) {
  if (!local.includes(name)) {
    console.error(`ERROR: unknown or untestable library "${name}"`);
    process.exit(1);
  }
}
const targets = requested.length ? requested : local;

const failed = [];
for (const [i, name] of targets.entries()) {
  console.log(`\n[${i + 1}/${targets.length}] ${name}`);
  const result = spawnSync(
    process.execPath,
    [NG, 'test', name, '--watch=false'],
    { cwd: ROOT, stdio: 'inherit' },
  );
  if (result.status !== 0) failed.push(name);
}

console.log(
  failed.length
    ? `\nFAILED (${failed.length}/${targets.length}): ${failed.join(', ')}`
    : `\nAll ${targets.length} libraries passed.`,
);
process.exit(failed.length ? 1 : 0);
