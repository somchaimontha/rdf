# Thai / English i18n

The shared dictionary and translation engine are in `assets/js/i18n.js`. Supported language codes are `th` and `en`; `rdfLang` stores the preference. An invalid preference falls back to `RDF.DEFAULT_LANG`. If storage access fails, switching still works for the current page.

## UI translations

- Wrap only the text in `<span data-t="save">บันทึก</span>` when a button also contains icons, counters, or other elements. Translation sets `textContent` on the tagged element.
- Use `data-t-placeholder`, `data-t-title`, `data-t-aria-label`, or `data-t-alt` for independent translated attributes. The existing `data-t` + `data-t-attr` form remains supported.
- Keep matching keys in both dictionaries. Unknown keys preserve authored HTML text; `t(key)` falls back to Thai, then the key.
- A mutation observer translates tagged elements inserted by modal and asynchronous renderers. It scans added element subtrees and ignores text-node updates, avoiding translation loops.
- Call `setLang(lang)` to change language. `rdf:languagechange` fires once when the normalized language changes. Page listeners refresh cached data; do not fetch again or reopen forms just to translate labels.
- Preserve option `value`, form values, checkbox selections, filter values, student records, and permission state. Translate display labels, not stored codes or user-authored content.
- Use `getLocale()` for display dates. Academic years explicitly labelled B.E. remain B.E.; switching language must not reinterpret stored years.
- Native language names, personal names, user-entered text, and the deliberately bilingual profile print form retain their original content.

## Changes covered

Static headings, buttons, options, help text, placeholders and tooltips across the ten pages now use the shared dictionary. Dynamic refresh covers dashboard charts and alerts, student listings/profiles, academic results, academic terms, promotion, and settings display lists. Settings permission checkboxes retain unsaved selections during relabeling. Profile rendering and chart rendering reuse cached data.

Report chart capture uses the selected report language, finishes chart updates before capture, and restores the screen language in a `finally` block. It does not persist the temporary report language or change report-form selections.

## Validation

From the repository root:

```sh
node --test tests/i18n.test.cjs
```

This checks invalid/unavailable storage, switching and form-value preservation in the shared engine, translation-key parity and coverage (including attribute keys), JavaScript syntax, untranslated Thai in the English dictionary, and language restoration after report capture failure.

For the browser suite, start a separate Chrome profile with remote debugging. On macOS, for example:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --remote-debugging-port=9222 --user-data-dir=/private/tmp/rdf-i18n-browser-test --no-first-run
```

In another terminal:

```sh
node tests/i18n.browser.cjs 9222
```

The suite serves the repository on an ephemeral localhost port and tests all ten pages with both Thai and English as the saved initial language. It verifies round trips, input/selection preservation, translated dynamic elements and attributes, no additional API calls from switching, open settings/report forms, and report chart labels independently of the screen language.

Browser tests use fixture APIs and stubs for external libraries (Chart.js, SweetAlert, icons, and Tailwind). They validate real DOM behavior and chart configuration, not production authentication, Google Apps Script writes, rendered Chart.js images, PDF pagination, or visual layout with CDN fonts/styles. No production records are changed. Advanced import/merge actions and every possible backend error message are not exhaustively exercised by this suite.
