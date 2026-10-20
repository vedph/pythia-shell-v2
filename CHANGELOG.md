# History

## unpublished

- 2026-10-19:
  - migrated to M3 styles adding dark/light themes.
  - responsive layout revision. The library views now lay out according to the width available to them (CSS container queries) rather than to the window width, so that they adapt also when embedded in a narrower host. Grid columns use `minmax(0, ...)`, so that wide content (tables, charts) never pushes the page beyond the window; wide tables scroll horizontally inside their own wrapper. Sticky panels stop below the host app sticky header, whose height is read from the `--pythia-sticky-top` CSS variable (default `64px`, a Material toolbar).
    - `pythia-word-index` (11.0.2):
      - when scrolling a tall words tree, the counts panel (attributes selector and charts) stays in view at the top right, so that clicking a node chart button visibly updates it; its charts scroll inside it when they do not fit. In the single column layout, where the panel follows the tree, the panel is scrolled into view instead. The tree filters are sticky too, and come before the tree (rather than after it) when there is no room for a side column, their fields flowing in rows.
      - token counts: the chart takes the full panel width; its legend is a single scrollable row below the pie, so that it no longer overlaps it; slice labels have the theme text color, and tiny or overlapping ones are hidden (values are in tooltips and in the table). The data table is collapsed below the chart (its header shows the total), and the copy/download buttons are right-aligned below it. The chart is described to assistive technologies (ECharts `aria`).
      - the attribute titles (now `div.title`, with `role="heading"`) use the M3 `title-medium` typescale.
    - `pythia-document-reader` (11.0.4): the document heading (now `div.doc-head`, with `role="heading"`) uses the M3 `title-medium` typescale and shape tokens. As this component has no view encapsulation, its rules are now scoped under its element: before, its `div#container`, `div#map` and `div#body` rules leaked to any other component using these IDs. The map and the text now scroll in boxes of limited height (`--pythia-reader-max-height` CSS variable, default `70dvh`), so that a whole document no longer takes several screens below search results or documents; the text is a single flow rather than CSS columns, whose reading order does not fit a scrolling box, and it can be scrolled with the keyboard.
    - `pythia-search` (11.0.4): the export button is placed below the results; before, being outside the layout grid areas, it ended up below the document reader. Removed the negative margin of the search button, which overlapped the query hint.
    - `pythia-document-list` (11.0.2), `pythia-corpus-list` (11.0.4): container-based layout; paginators shrink and wrap rather than overflow.
    - `pythia-query-builder` (11.0.2): the entries table scrolls horizontally on narrow screens; spacing between the bottom buttons.
  - app: added the CDK visually hidden styles (`cdk.a11y-visually-hidden`), used by table headers read only by assistive technologies.
- 2026-10-16:
  - app: added `rateLimitInterceptor`, so that when the API rejects a request because of its rate limit (429 Too Many Requests), users get a message telling them to wait (with the seconds requested by the server's `Retry-After` header, if any) and try again, rather than a silent failure. Requests are automatically retried (up to 3 times) only when the server asks to wait for at most 5 seconds; the message is shown once for concurrent rejections, after any message opened by the consumer of the failed request, which still gets the original error.
  - localized the snackbar messages which were hard-coded in English: `pythia-search` (`SearchExportComponent`: "Results exported", "Error exporting results", whose action label is now "OK" rather than "Error"), `pythia-stats` ("Error getting stats"; added the `@angular/localize` types to its `tsconfig.lib.json`, as this is its first localized message), `pythia-corpus-list` ("Error deleting corpus", "Error saving corpus"). Bump the versions of these packages before publishing them.

## 11.1.0 - unpublished

- 2026-10-16:
  - `pythia-search`, `SearchComponent`: added the `hideMap` input, passed to its document reader, so that consumers can disable the document map (e.g. to let users read only the context of search results, without browsing whole documents). When the map is hidden, the "read document" button is hidden too, as reading a whole document requires its map.
  - `pythia-document-reader`, `DocumentReaderComponent`: when `hideMap` is true, the map is not even loaded (new `noMap` parameter of `DocumentReaderRepository.load`).
  - `pythia-document-reader`, `DocumentReaderRepository`: fixed a slower text load (from a map path or a range) overwriting the text of a document loaded meanwhile.
  - `pythia-corpus-list`: the corpora list now requests documents counts rather than their IDs, which the list does not use. This matches the backend fix of the `counts` parameter, which was inverted (Pythia API 12.1.2).

## 11.0.0

- 2026-10-09:
  - ⚠️ migrated to signal-based forms bumping major version to 11.
  - updated Angular and packages.
  - replaced the libraries build chain with `scripts/build-libs.mjs` (`pnpm run build:libs`), which builds the libraries in dependency order (derived from manifests and actual imports) after checking via `scripts/check-local-libs.js` that no local library is shadowed by a copy in `node_modules`. Use `pnpm run build:libs <name>` to rebuild a library and everything downstream of it.
  - ⚠️ migrated library tests from Karma/Jasmine to Vitest (`@angular/build:unit-test`), removing the Karma and Jasmine packages and adding jsdom and Angular Testing Library. Run all the library tests with `pnpm run test:libs` (after `pnpm run build:libs`, as libraries import each other from `dist`).
  - added unit tests for all the libraries, fixing these bugs:
    - `pythia-api`, `ReaderService.getNodePath`: the path was built from the target node up to the root (e.g. `0.2.1` instead of `0.1.2`), so clicking any document map node below the first level loaded the wrong text (or none). The backend expects the path from the root down.
    - `pythia-api`, `DocumentService.getDocuments`: `minTimeModified`/`maxTimeModified` were sent via `Date.toString()` (e.g. `Fri Oct 09 2026 ... GMT+0200 (CEST)`), which the backend cannot bind to a `DateTime`, making the request fail. They are now sent in ISO format, as `TermService` already did.
    - `pythia-api`, `SearchService.search`: sort fields were sent as a single `sort` CSV parameter, which the backend ignores; they are now sent as repeated `sortFields` parameters, matching the backend `SearchBindingModel.SortFields` list.
    - `pythia-corpus-list`, `CorpusFilterComponent`: the buttons were bound to the `disabled` signal function rather than its value (`[disabled]="disabled"`), so they were always disabled and the corpus filter could not be applied or reset.
    - `pythia-corpus-list`, `CorpusEditorComponent`: the "too long" errors checked the `maxLength` error key, while Angular uses `maxlength`, so they were never shown.
    - `pythia-corpus-list`, `CorpusEditorComponent`: when the user name contains `_`, the ID prefix was split at the first `_` (e.g. `john_doe_c1` was shown as `doe_c1` and saved as `john_doe_doe_c1`, creating a new corpus). The current user's prefix is now stripped as a whole when present.
    - `pythia-corpus-list`, `CorpusListComponent`: refreshing the list (also after saving or deleting) called the store's `reset`, which loads the unfiltered list, and then set the user filter, issuing two concurrent requests: if the unfiltered one completed last, non-admin users were shown all the corpora. Now the cache is just cleared before setting the filter.
    - `pythia-corpus-list`, `CorpusListComponent`: changing the page size could show a cached page of the previous size, as the store's cache keys do not include the page size (this is an upstream `@myrmidon/paged-data-browsers` issue): now the cache is cleared when the page size changes.
    - `pythia-corpus-list`: added accessible names to icon-only buttons and fixed the list table header markup.
    - `pythia-document-list`, `DocumentListComponent`: the document attributes loaded by the repository were never passed to the filter, so attribute filters were never available. They are now bound.
    - `pythia-document-list`, `DocumentListComponent`: the filter UI was not bound to the store filter, so after "Refresh" (which resets the filter) the form still showed the old values while the list was unfiltered. The filter is now bound to the store filter.
    - `pythia-document-list`, `DocumentFilterComponent`: when loading a filter, corpus and profile were restored only if both were present, because `forkJoin` emits nothing when a source (`from([])`) is empty. Unchanged corpus/profile are no longer refetched.
    - `pythia-document-list`, `DocumentFilterComponent`: attribute filters without a value were sent as `name=undefined`; incomplete attribute filters are now skipped (the backend requires both name and value).
    - `pythia-document-list`, `DocumentFilterComponent`: the profile chip had no remove button, so the profile filter could not be removed; the attribute value "too long" error checked the wrong error key (`maxLength` instead of `maxlength`).
    - `pythia-document-list`, `DocumentRepository`: same page size cache issue as the corpus list.
    - `pythia-document-list`, `DocumentCorpusComponent`: `apply` now also refuses non-editable corpora (the button was already disabled).
    - `pythia-document-list`: added accessible names to icon-only buttons and fixed the list table header markup; removed a duplicate export from the public API.
    - `pythia-document-reader`, `MapPagedTreeStoreService`: flattened map nodes used their text start as ID, but a node and its first child usually share the same start (and the root's start 0 was treated as "no parent"), so expanding/collapsing nodes and listing children in the map browser could target the wrong nodes. Nodes now get unique sequential IDs; nodes with an empty children array are no longer shown as expandable.
    - `pythia-document-reader`, `DocumentReaderRepository`: a requested range starting at 0 (e.g. a search hit at the beginning of a document) was ignored; a failed load left the progress bar spinning forever; a slower previous load could overwrite the current document; the text loaded for a range was not stripped of its HTML envelope like other texts; the body extraction failed when the HTML started with `<body>` or had content after `</body>`.
    - `pythia-document-reader`: removed a leftover `console.log`, avoided unhandled promise rejections on text load errors, added accessible names to the map filter controls.
    - `pythia-query-builder`, `QueryBuilder`: the fuzzy matching treshold was emitted after the closing quote (`[value%="a":0.5]`), which is a syntax error for the backend grammar; it is now inside the value (`[value%="a:0.5"]`) as documented, and omitted when empty (previously a dangling `:`).
    - `pythia-query-builder`, `QueryBuilder`: location operators args left without a value (as copied from their definitions when the user does not edit them) were not supplied with their defaults, so setting just `n` was reported as invalid; and an `s` arg without value made every `NOT` location operator invalid ("Argument s cannot be used with NOT"). Also, an empty first arg produced a leading comma (e.g. `NEAR(,m=3)`).
    - `pythia-query-builder`, `QueryBuilder`: when inserting a pair before or after another pair, the automatic `AND` was appended at the end of the query rather than next to the inserted pair; when replacing an entry, a spurious `AND` could be appended at the end.
    - `pythia-query-builder`, `QueryBuilder` validation: a query starting with `(` was always reported as unbalanced; nested opening brackets (`((`) were rejected; `)` before its `(` and a pair right after `)` were accepted; values containing double quotes (which cannot be escaped in the query syntax) are now rejected.
    - `pythia-query-builder`, `QUERY_PAIR_OP_DEFS`: the `<=` operator had a garbled label and no group.
    - `pythia-query-builder`, `CorpusSetComponent`: the duplicate check compared each corpus with itself, so only one corpus could be added to the set; the lookup user filter was passed the signal function instead of its value.
    - `pythia-query-builder`, `QueryOpArgsComponent`: `min: 0` constraints were ignored (allowing negative distances), and the numeric pattern accepted any character as decimal separator.
    - `pythia-query-builder`: "too long" value error key fixed (`maxlength`); added accessible names to icon-only buttons.
    - `pythia-search`, `SearchRepository`: a failed search request (e.g. server or network error) left the progress bar spinning forever, with no error shown and an unhandled promise rejection; the error is now shown and loading stops. Same page size cache issue as the other lists.
    - `pythia-search`: reading in context a hit at the very beginning of a document (index 0) now works (see the `pythia-document-reader` fix); "query too long" error key fixed; the CSV export now releases its object URL; added accessible names to icon-only buttons and table headers.
    - `pythia-stats`, `PythiaStatsComponent`: the "refresh" button had no click handler, and refreshing would anyway have returned the session-cached statistics; it now reloads them from the server.
    - `pythia-word-index`, `TokenCountsListComponent`: two different words were considered equal when they had the same lemma (or none, as when the index has no lemmata), so requesting the distribution of another word kept showing the counts of the first one. Also, a token arriving while loading was dropped, and a loading error left the component busy forever.
    - `pythia-word-index`, `PagedWordTreeFilterComponent`: only the first `*` and `?` wildcards in the value pattern were converted to the SQL wildcards expected by the backend; reloading a filter now shows `*`/`?` rather than `%`/`_`; an ascending sort order is matched also when the filter has `isSortDescending: false`.
    - `pythia-word-index`, `TokenCountsComponent`: the CSV `attr_name` column contained the name of the signal function rather than the attribute name; CSV values with commas or quotes are now escaped; the download link is removed and its object URL released.
    - `pythia-word-index`, `PagedWordTreeStoreService`: without lemmata, words were placed at depth 2 under a root at depth 0 (instead of 1), with a wrong indentation and location.
    - `pythia-word-index`: avoided crashes and unhandled rejections when the words tree fails to load; removed leftover `console.log` calls; fixed an invalid CSS border value; added accessible names to icon-only buttons.
    - note: `PagedTreeStore` and `PagedListStore` in `@myrmidon/paged-data-browsers` have upstream issues: list cache keys ignore the page size (worked around here), and tree `expand`/`changePage` do not handle server errors (the promise never settles and the error is unhandled).
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
