# Reactive → signal forms migration log

Only verified facts are recorded here. Anything not measured is marked
**believed**, with how to check it.

## Environment (verified 2026-10-09)

- Angular / `@angular/forms` 22.2.1; tests: vitest via `@angular/build:unit-test`.
- Baseline before migration: all 9 testable libraries green (`node scripts/test-libs.mjs`).
- Library resolution: `tsconfig.json` paths → `./dist/myrmidon/<lib>`; no
  `@myrmidon/pythia-*` in `node_modules`. `scripts/check-local-libs.js` (guard)
  and `scripts/build-libs.mjs` (dependency-ordered build, runs the guard) already
  existed; no change needed.
- Build order (from `build-libs.mjs --dry`): core, api, ui, corpus-list,
  document-list, document-reader, query-builder, search, stats, word-index.
- Signal-forms facts checked in the installed sources:
  - `required` treats `''`, `false`, `null`/`undefined`, `NaN` as empty.
  - error kinds: `'required'`, `'maxLength'`, …
  - `FieldState.reset(value?)` without argument clears touched/dirty only.
  - `disabled(path, { when })` is the non-deprecated form.
- `[formField]` projects `required` / `maxLength` onto native `required` /
  `maxlength` attributes (measured in jsdom tests and in Chrome: `maxlength="45"`
  on the corpus ID input). Consequences: the browser caps typing at the limit,
  and Material shows its required marker (`*`) on required fields.

## Browser verification setup

- `ng serve` on :4200 after `rm -rf .angular/cache`; API on :5000; user
  `zeus` / `P4ss-W0rd!`.
- Headless Chrome `--remote-debugging-port=9222`, scripted via
  `Runtime.evaluate`.
- Served-code check: the dev build bundles everything into `main.js`; the
  reliable signal was the DOM (`<form>` count inside the migrated widgets).

## pythia-corpus-list — done

Components: `corpus-editor`, `corpus-filter`; `corpus-list` only dropped an
unused `ReactiveFormsModule` import.

- `corpus-editor` (manual save): canonical template. `linkedSignal` draft with
  `previous` echo check; `toDraft(corpus, idPrefix)` / `toModel(draft, corpus,
  idPrefix)` pure functions; `sourceId` (set from the nested lookup) lives in
  the draft, so it is discarded with it when a new corpus is bound — this
  replaces the old `_sourceId` field. No `<form>`; Save is `type="button"
  (click)="save()"`.
- `corpus-filter` (manual apply): draft is a plain `linkedSignal(() =>
  toDraft(filter()))` — every incoming filter rebuilds, exactly as the old
  effect did. Enter-to-apply kept via `(keydown.enter)="apply()"`; `apply()`
  returns early when `disabled()`, because the old implicit submission was
  blocked by the disabled submit button.

Deliberate behaviour changes (owner should know):

1. Editor: typing past max length is now blocked by native `maxlength`; the
   "too long" error shows only for an over-long *bound* value. Tests rewritten
   to cover both.
2. Editor: Enter in ID/title no longer saves (was implicit form submission).
   Pinned by a test.
3. Editor: binding a different corpus now also resets the `clone` checkbox.
   Before, `clone` survived while `_sourceId` was cleared, so the lookup could
   show a source that would not be saved.
4. Filter: a field the user typed and then cleared is emitted as `undefined`
   instead of `''`. Verified harmless for the request: the API call carried
   only `title=myth` (no empty `id=`).

Verification:

- `ng test @myrmidon/pythia-corpus-list`: 57/57 green (was 47; added echo,
  no-`<form>`, Enter, invalid-save, rebind, disabled-Enter, maxlength tests).
- `ng build` corpus-list: clean; no downstream libraries.
- Chrome, `/corpora`: 0 `<form>` in the list; filter Enter → request
  `…/api/corpora?pageNumber=1&pageSize=20&title=myth` (trimmed); Add corpus →
  editor in the expansion panel, Enter in title did not send a request, clone
  shows the nested `cadmus-refs-lookup`; Save → API record
  `{"id":"zeus_cdp_test","title":"CDP test","description":"","userId":"zeus"}`;
  Edit reloads with ID `cdp_test` (prefix stripped), clone unchecked. Test
  corpus deleted afterwards.

## Verified hazard: rebuilding a library under a running `ng serve`

Measured 2026-10-09: ng-packagr deletes `dist/myrmidon/<lib>` at build start.
The running `ng serve` rebuilt in that window, failed with `TS2307: Cannot find
module '@myrmidon/pythia-document-list'`, and did **not** rebuild once the new
dist was written. The browser kept receiving the last good (stale) bundle: the
DOM still showed the old `<form>` inside `pythia-document-filter`. Restarting
`ng serve` after `rm -rf .angular/cache` fixed it (0 `<form>`).
Rule used from here on: stop/restart `ng serve` after every library build.

## pythia-document-list — done

- `document-filter` (manual apply, async lookups): the draft holds the
  `Corpus`/`Profile` objects. `linkedSignal` rebuilds the draft from every
  incoming filter; its `previous` only keeps an already loaded corpus/profile
  whose ID is unchanged (the old "reuse when unchanged" rule). A separate
  effect fetches missing objects and patches them into the draft with
  `update()`, unsubscribing on cleanup, so a load superseded by a newer filter
  is dropped (old code had no cancellation). Attributes: former `FormArray`
  → `attrs` array, `applyEach` rules, add/remove by spreading.
  Static `maxlength="500"` on author/title/source → `maxLength(path.x, 500)`:
  **verified** `NG8022` forbids a static `maxlength` on a `[formField]` node;
  the rendered native attribute is unchanged (`maxlength="500"` in Chrome).
  Enter-to-apply via `(keydown.enter)` on the text/number/date inputs, guarded
  by `disabled()` as in corpus-filter.
- `document-corpus` (no model): plain `signal` draft; `corpusId` comes from the
  nested lookup but keeps `required` + `maxLength(50)`.

Deliberate behaviour changes:

1. Attribute value: typing capped at 100 by native `maxlength` (was: error).
2. Filter: cleared text fields emit `undefined` rather than `''` (as in
   corpus-filter).
3. Filter: while a corpus/profile for a new ID loads, the draft shows none
   (old code kept showing the previous object, which `apply()` would then
   have sent with the wrong ID).
4. document-corpus: Enter inside the nested lookup input no longer submits.
   **Believed** harmless (autocomplete Enter normally selects an option);
   not measured.

Measured, not a regression: with a `mat-select`, open → Escape → Tab leaves the
control untouched under **both** reactive forms and `[formField]`
(focus → Tab marks both touched). Checked with a temporary side-by-side spec,
since deleted.

Verification:

- `ng test @myrmidon/pythia-document-list`: 61/61 (was 54).
- `ng build`: clean; no downstream libraries.
- Chrome `/documents` (after restarting `ng serve`): 0 `<form>`; Enter in
  author → `…/api/documents?…&author=a` (trimmed); Enter in min date →
  `…&author=a&minDateValue=100`; reset clears the controls; attribute row:
  pick `atto`, value ` x `, Enter → `…&attributes=atto=x`, remove row works.
  Nested `document-corpus`: Apply disabled until a corpus is picked; picking
  (via the lookup's own `pickItem`, because headless autocomplete would not open)
  enabled it, and Apply sent `PUT …/corpora/zeus_cdptmp/add`. Filter lookup →
  Apply sent `…/documents?…&corpusId=zeus_cdptmp` and **no** corpus refetch
  for the echoed filter. Temporary corpus deleted.
- Console: `NG0956` (track-by-identity re-creation) for the 20-row document
  list (`track c` in document-list, not migrated code) and for the 1 attribute
  row after apply. The latter is **believed** pre-existing: the old code also
  rebuilt the `FormArray` with new groups on every filter echo. To check: run
  the pre-migration build and apply a filter with one attribute.

## Verified hazard: FieldTree identity tags reach nested arrays

Measured 2026-10-09 (Angular forms 22.2.1, throwaway specs since deleted):
the identity Symbol is not limited to the items of an array *field*. With a
model `{ type: def }`, where `def.args` is an array of objects, the items of
`def.args` were tagged after merely rendering `[formField]` on a `mat-select`,
after reading `f.type().value()` in a template, and after reading root
`f().valid()` / `f().dirty()`, with no schema rules at all. Spreading
(`{...a}`) copies the tag along (it is an enumerable own Symbol property);
`JSON.parse(JSON.stringify(x))` does not.
Consequence: a draft must never hold shared constants that contain arrays of
objects (here the `QUERY_*_DEFS` definitions and their `args`); the component's
option lists must be its own copies too, because `mat-select` writes the
chosen option object into the draft. Pinned by tests asserting that no
`QUERY_*_DEFS` object or arg carries an own Symbol.

## pythia-document-reader — done

- `document-reader`: only unused `FormsModule`/`ReactiveFormsModule` imports
  removed.
- `map-paged-tree-browser`: the label filter is `form(signal({ label: '' }))`
  with a `debounce(path.label, 300)` rule; an effect applies the (debounced)
  model value to the store (`setFilter` in `untracked`). The Clear button reads
  `controlValue()`, which is immediate, as the old `FormControl.value` was.
  Old `valueChanges` subscription + `ngOnDestroy` removed.
- Tests: 42/42 (was 40). Build: reader, query-builder, search clean.
- Chrome (search → "Read in context"): Clear filter disabled → typing
  enabled it at once, the tree still showed 21 nodes immediately and 1 after
  the pause; Clear emptied the input and disabled itself.

## pythia-query-builder — done

- `query-op-args` (manual save, nested in `query-entry`): rows `{ def, value }`
  with `applyEach`: `required` when `def.required`; a `validate` reproducing the
  reactive validators (anchored numeric pattern; min/max on `parseFloat` of the
  string, skipped when empty or NaN). The input keeps a dynamic
  `[type]="numeric ? 'number' : 'text'"`: **verified in source** that the native
  control reads/writes according to the *model value's* type, so a `string`
  field on `type="number"` stays a string (pinned by a test). Enter saves only
  when valid and dirty, which is exactly when the old implicit submission
  happened (submit button enabled). `linkedSignal` + `previous` echo check:
  `toModel()` drops valueless args, so before, saving made the unvalued args
  vanish from the editor (old effect rebuilt from the echo); now they stay.
- `query-entry`: `entryTypes` is now a `computed` of `isDocument` (was set in
  `ngOnInit`). The old `valueChanges` subscriptions (type → args, operator →
  pairArgs) are `(selectionChange)` handlers, which fire only on user changes;
  the load path, previously `setTimeout` + those subscriptions, is computed in
  `toDraft()`. Clause rules only apply to pairs, via `applyWhen` on the type.
  Definitions are kept out of the form as described above (JSON copies,
  `compareWith` by `value` on the three selects; verified `value` is unique
  in every `QUERY_*_DEFS` list and across token+structure attributes).
  Two nested `<form>`s plus op-args' `<form>` removed; Save is `type="button"`.

Deliberate behaviour changes:

1. Arg values and the pair value: typing capped by native `maxlength` (pair
   value 100) where a cap applies; numeric args with bad input now get a
   `parse` error (shown as "invalid value") instead of reading as `''`.
2. op-args keeps unvalued args visible after saving (see above).
3. query-entry: a loaded non-pair entry without `opArgs` gets its type's
   default args; the old code kept whatever args the previous entry left
   when the type was unchanged (`distinctUntilChanged`).
4. query-entry: selection in the three selects now shows for deep-copied
   entries. `query-entry-set` edits `deepCopy(entry)`, so the old identity
   comparison is **believed** to have shown attribute/operator unselected
   when re-editing a pair (not measured on the old build; check by running
   it and editing a saved pair). Measured now in Chrome: re-editing shows
   "value" / "is similar to" selected.
5. query-entry: invalid Save now marks the fields touched (shows the errors).

Tests: 110/110 (was 97). Build: query-builder, search clean.

## pythia-search — done

- Signal `form` over `{ query: string; history: string | null }`, `required`
  + `maxLength(1000)` on the query. No `<form>`; Search is
  `type="button" (click)="search()"`. Implicit submission never applied here
  (the query is a `<textarea>`); Ctrl+Enter is the existing explicit handler.
- Tests: 34/34 (was 33). Build clean.

Chrome, search group (after restarting `ng serve`): 0 `<form>` on the page;
query textarea `maxlength="1000"`; Ctrl+Enter →
`…/api/search?query=[value="contratto"]…`, 20 rows; "Read in context" opened
the reader (see tree filter above). Builder tab (search → query-builder →
entry-set → query-entry → op-args): pair value / "is similar to"; threshold
1.5 → "value too big" with Save arguments disabled; 0.8 + Enter saved the
args (button disabled again, value kept); Enter in value saved the entry
("value is similar to contratto"); Build → query `[value%="contratto:0.8"]`
and request `…/api/search?query=[value%="contratto:0.8"]…`.

## pythia-word-index — done

- `paged-word-tree-filter` (manual apply; also usable as a dialog): plain
  `linkedSignal` rebuild from `filter`, with `toDraft`/`toModel` holding the
  `*`/`?` ⇄ `%`/`_` wildcard mapping. The "reset sort order when the entries
  change" effect is kept, its read of the form value now in `untracked`.
  Dialog injection moved to `inject(..., { optional: true })`.
  **Verified** `NG8022` also forbids a static `min="0"` on a `[formField]` node:
  replaced with `min(path.x, 0)` rules (same native `min="0"` in Chrome).
  Enter-to-apply via `(keydown.enter)` on the inputs; `apply()` returns when
  the form is invalid (the old disabled submit button blocked implicit
  submission the same way).
- `token-counts-list`: the multi-select holds attribute **names** (the
  `AttributeInfo` objects belong to the caller, and a form would tag them);
  `selectedAttributes` is a `computed` mapping names back to objects in list
  order (the order `mat-select` gave before). The token effect calls
  `loadCounts()` in `untracked`. Measured: removing that `untracked` does not
  fail the new "no load on selection" test, because the effect returns early
  on an equal token, so it is hygiene here, not a fix.
- `paged-word-tree-browser`, `word-index`, `token-counts`: unused
  `ReactiveFormsModule` removed. (`TOKEN_COUNTS_TEST_IMPORTS` needed no change:
  no signal-forms symbol is used in those templates.)

Deliberate behaviour changes:

1. Negative lengths/frequencies now make the filter invalid (Apply disabled,
   Enter ignored). Before, the native `min` had no effect on Angular validity
   and a negative value was sent to the API.
2. Cleared language emits `undefined` rather than `''`.

Verification:

- `ng test @myrmidon/pythia-word-index`: 52/52 (was 46). Build clean (no
  downstream libraries).
- Chrome `/words` (after restarting `ng serve`): 0 `<form>`; value pattern
  `contr*` + Enter → `…/api/lemmata?…&valuePattern=contr%`, and the echoed
  filter shows `contr*` again; POS noun + Apply → `…&pos=NOUN&valuePattern=contr%`;
  min.freq. −1 disabled Apply. Nested token counts: selecting `atto` sent no
  request; "Set selected attributes" → `…/api/lemmata/4030/counts?attributes=atto`,
  one chart rendered.

## Demo app pages (in scope: corpora, search-page, words-page, auth pages)

- corpora, search-page: no forms code; nothing to change.
- words-page, login-page, manage-users-page, register-user-page: only an
  unused `ReactiveFormsModule` import, removed. (The cadmus-shell-v3
  counterparts are themselves still reactive-forms code, so there was no
  signal-forms version to borrow.)
- reset-password: migrated (`required` + `email`). **Pre-existing bug fixed as
  a consequence, measured in Chrome:** the "reset password" button was
  `type="submit"` but outside the `<form>` (inside `mat-card-actions`), so a
  click did nothing; only Enter (implicit submission) reset, and that path
  ignored validity. Now the button is `type="button" (click)="reset()"`, Enter
  is `(keydown.enter)`, and `reset()` refuses an invalid form. Chrome: invalid
  address → "invalid email address", button disabled, Enter sent no request;
  `nobody@example.invalid` + click → `POST …/api/accounts/resetpassword/request`
  (400 from the API for an unknown user; error snackbar shown).
- Login (zeus) and /manage-users still work after the import removal (Chrome).

## Final state (verified 2026-10-09)

- No `@angular/forms` import left in `projects/**` or `src/**` (non-spec).
- `node scripts/test-libs.mjs`: all 9 testable libraries green, 429 tests
  (baseline 359).
- `node scripts/build-libs.mjs`: all 10 libraries built in order, guard OK.
- `ng build` (app): clean.

## Follow-up (owner request, 2026-10-09)

- `src/app/app.component.spec.ts` deleted by the owner. The other app specs
  (corpora, documents, home, login-page, manage-users-page,
  register-user-page, reset-password, search-page, words-page) and the app
  `test` target still exist.
- All 18 `ChangeDetectionStrategy.Eager` library components → `OnPush` (in
  Angular 22 OnPush is also the default; kept explicit per guidelines).
  Audit: every template-visible state was already a signal, an `async`-piped
  observable assigned once, or form state (signals), except
  `map-paged-tree-browser`, whose `nodes$`/`filter$` were plain fields
  reassigned in an effect when the map changes; they are now signals
  (`nodes$()` in the template).
- `pythia-search`: `@ViewChild('queryCtl')` → `viewChild<ElementRef<HTMLTextAreaElement>>('queryCtl')`.
  No decorator-based queries/inputs/outputs/host bindings remain.
- `document-list`: `track item` → `track item.id` (document IDs unique).

Verification: all 9 library suites green (429), full ordered build clean,
then Chrome after restarting `ng serve`: documents list re-renders on
filter (0 rows), reset (20) and page 2, with **no** NG0956; search with
Ctrl+Enter (20 rows), Read in context, tree filter (21 → 1 nodes, Clear);
builder chain → `[value%="contratto:0.8"]`; history pick fills and focuses
the textarea (viewChild); corpora filter/editor/save/edit as before (test
corpus deleted); words filter, tree expand (21 → 22 nodes), token counts,
and the node filter dialog (16px wrapped margin, Apply closed it and sent
`…/api/words?…&valuePattern=a%&lemmaId=4030`).

KWIC results (`pythia-search`): the table tracked rows by identity
(`track r`, NG0956 on every search). Measured on 100-hit pages of
`[value="a"]` and `[value="contratto"]`: the server `id` (typed `string` but
sent as a number) and document ID + `p1` were both unique, but that is not
guaranteed across span types. So `SearchRepository.loadPage` now maps each
loaded result to a `KwicSearchResultItem` with a client-side numeric `key`
from a module counter (not `crypto.randomUUID()`, which only exists in
secure contexts), and the template uses `track r.key`. Cached pages re-emit
the same objects, hence the same keys. **Verified in Angular source**: NG0956
is raised only for identity tracking, so re-creating rows for a new page is
now silent (and correct). Tests 35/35 (one new); Chrome: two searches, next
and previous page all re-rendered correctly with no NG0956.

## Out of scope — reported, not changed

1. The app test target does not compile: `TS2339: Property 'title' does not
   exist on type 'AppComponent'` in `src/app/app.component.spec.ts`
   (file untouched by this migration). Several app specs also still use
   `declarations: [...]` for standalone components (corpora, documents, home,
   login-page, manage-users-page, register-user-page, reset-password,
   search-page); **believed** to fail once the compile error is fixed.
2. ~~Eager components~~, ~~`@ViewChild`~~, ~~document list NG0956~~: fixed
   in the follow-up above.
5. `login-page` logs the logged-in user object with `console.log` (app code).
6. No `console.log` calls found in library code.
