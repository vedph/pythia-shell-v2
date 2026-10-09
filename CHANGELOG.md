# History

- 2026-10-09:
  - updated Angular and packages.
  - replaced the libraries build chain with `scripts/build-libs.mjs` (`pnpm run build:libs`), which builds the libraries in dependency order (derived from manifests and actual imports) after checking via `scripts/check-local-libs.js` that no local library is shadowed by a copy in `node_modules`. Use `pnpm run build:libs <name>` to rebuild a library and everything downstream of it.
  - migrated library tests from Karma/Jasmine to Vitest (`@angular/build:unit-test`), removing the Karma and Jasmine packages and adding jsdom and Angular Testing Library. Run all the library tests with `pnpm run test:libs` (after `pnpm run build:libs`, as libraries import each other from `dist`).
  - added unit tests for all the libraries, fixing these bugs:
    - `pythia-api`, `ReaderService.getNodePath`: the path was built from the target node up to the root (e.g. `0.2.1` instead of `0.1.2`), so clicking any document map node below the first level loaded the wrong text (or none). The backend expects the path from the root down.
    - `pythia-api`, `DocumentService.getDocuments`: `minTimeModified`/`maxTimeModified` were sent via `Date.toString()` (e.g. `Fri Oct 09 2026 ... GMT+0200 (CEST)`), which the backend cannot bind to a `DateTime`, making the request fail. They are now sent in ISO format, as `TermService` already did.
    - `pythia-api`, `SearchService.search`: sort fields were sent as a single `sort` CSV parameter, which the backend ignores; they are now sent as repeated `sortFields` parameters, matching the backend `SearchBindingModel.SortFields` list.
- 2026-08-27: updated packages.

## 9.0.0

- 2026-06-26:
  - updated Angular and packages.
  - implemented missing members in lookup services.
- 2026-02-06:
  - updated Angular and packages.
  - minor improvements.
  - updated library peer dependencies.
  - migrated to `OnPush`.
  - ⚠️ migrated to zoneless.
- 2026-01-09: updated Angular and packages.
- 2025-11-24:
  - ⚠️ upgraded to Angular 21.
  - migrated to `pnpm`.
- 2025-11-19:
  - added optional `sortFields` parameter to search service.
  - updated Angular and packages.
- 2025-11-13: updated Angular and packages.
- 2025-09-29: updated Angular and packages.
- 2025-09-18:
  - ⚠️ refactored components for full reactivity. All the libraries major versions have been increased (including those which had no changes, as anyway peer dependencies were updated).
  - updated Angular and packages.
  - in app, import NPM packages rather than from projects relative paths.
- 2025-07-29:
  - updated Angular and packages.
  - fixed disabled export button in search.

## 7.0.0

- 2025-06-03: ⚠️ upgraded to Angular 20.
- 2025-02-07:
  - added POS filter to word index (`@myrmidon/pythia-api`, `@myrmidon/pythia-word-index`).
  - updated Angular.
- 2025-01-29:
  - updated Angular and packages.
  - updated peer dependencies in libraries.
  - added view transitions.
- 2025-01-22: updated Angular.
- 2025-01-20: updated Angular.

## 6.0.2

- 2025-01-09:
  - updated Angular and packages.
  - 👉 removed direct import `import '@angular/localize/init';` and added `"types": ["@angular/localize"]` to the `tsconfig` file of each library using it. Note that to correctly work the localize package must be added to the `main.ts` as `/// <reference types="@angular/localize" />` and added to each consumer into its `tsconfig` types. The former is usually done by the `ng add @angular/localize` schematics.
- 2024-12-30: updated packages.

## 6.0.1

- 2024-12-29: updated packages.

## 6.0.0

- 2024-12-19:
  - updated Angular and packages.
  - removed `EnvServiceProvider`.
- 2024-12-16:
  - fixes to [ngx-echarts](https://github.com/xieziyu/ngx-echarts) usage for Angular 19. See sample code at <https://github.com/xieziyu/ngx-echarts-starter/blob/master/src/app/app.component.ts> for correctly importing dependencies in standalone with Angular 19.
  - updated Angular and packages.

📆 [previous history](https://github.com/vedph/pythia-shell)
