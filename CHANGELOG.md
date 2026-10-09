# History

- 2026-10-09: updated packages.
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
