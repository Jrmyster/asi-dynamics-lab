# English / Khmer localization update

## Install into the existing repository

1. Start from your existing checkout and update it before copying the new files:

   ```bash
   cd asi-dynamics-lab
   git pull --ff-only origin main
   ```

   If you have no checkout yet:

   ```bash
   git clone https://github.com/Jrmyster/asi-dynamics-lab.git
   cd asi-dynamics-lab
   ```

2. Extract the updated project ZIP and copy its contents into your checkout,
   retaining your checkout's `.git` directory. Alternatively, place the supplied
   patch beside the checkout, then run:

   ```bash
   git apply --check ../asi-dynamics-lab-i18n.patch
   git apply ../asi-dynamics-lab-i18n.patch
   ```

3. Open `index.html` directly. Choose **ខ្មែរ**, change controls, inject a patch,
   and switch back to **EN**. Time, capability, interventions, and playback remain
   intact. Reload to check the saved preference. Browser storage can be restricted
   for local files; in that case the toggle still works for the current session.

4. Validate and stage the site. Node.js 24 and Python 3 are used in CI:

   ```bash
   node --check simulation.js
   node --check i18n.js
   node --check app.js
   node --test tests/*.test.cjs
   python3 scripts/build.py
   ```

5. Commit and push the feature to the existing GitHub repository:

   ```bash
   git add index.html i18n.js app.js simulation.js styles.css README.md IMPLEMENTATION.md scripts/build.py tests/i18n.test.cjs .github/workflows/deploy.yml
   git commit -m "feat: add English and Khmer dashboard localization"
   git push origin main
   ```

The existing Pages workflow validates the model and translation coverage and then
deploys `dist/` on a push to `main`. Pages must use **GitHub Actions** as its source.
Branch protection may require pushing a feature branch and opening a pull request.
Do not commit generated `dist/` files.

## Architecture and behavior

The scripts load in order: `simulation.js`, `i18n.js`, `app.js`. They use classic
scripts so opening a local HTML file needs no module server or package installation.
`ASII18n.translations` contains matching `en` and `km` dictionaries. `t(key, params)`
interpolates named fields using plain text, never HTML. `setLanguage('km')` updates
`html.lang`, `.khmer-text`, all `data-i18n` elements and accessibility attributes,
then emits `i18n:change`. The UI reads the current model snapshot and redraws charts;
it does not reset parameters, simulation time, playback timers, or intervention history.

Live event messages use engine metadata rather than translating English strings by
pattern matching. Historical messages and milestone tooltips change immediately.
CSV column names, domain IDs, English export messages and model equations stay stable.
JSON events add `key` and `params` fields for localization without removing the
original `message` field; domain objects add stable `id` fields. Existing replay
behavior is preserved.

SI units and Latin numerical notation are retained for scientific readability.
Compact values use the locale-aware `Intl.NumberFormat`; precision-sensitive values
and scientific notation use the engine's existing formatting. Language names use
their native spellings. Safe / Warning / Critical are illustrative model states,
not real-world safety certification. The provided Khmer title is used exactly as
requested. README and the theoretical paper remain English documents.

Noto Sans Khmer uses Google Fonts with `display=swap`. CSS has a Khmer system-font
fallback, readable line heights and mobile wrapping. A network connection is needed
only to download the optional web font. The standalone HTML includes all program
code and translations; its optional font link has the same fallback behavior.

## Extending translations

Add a matching key to both dictionaries in `i18n.js`, then use `data-i18n="key"` on
static text or `ASII18n.t('key', { value })` for dynamic output. For a label with
nested controls or icons, put the attribute on its text span to preserve the children.
Translate accessible names with `data-i18n-aria-label`. Keep interpolation names
identical in both languages. Run the full tests before committing.


## Beginner experience (version 1.2)

The current dashboard introduces ASI, offers scenario cards, and presents everyday
controls, three key results and one chart. Optional technical details are under
**Explore the model**. The guided experiment pauses at observation points and
preserves its step when the language changes. Computing allocation can be set
with the qualitative slider or the synchronized exact input in Advanced settings.
Model equations and export/replay behavior remain unchanged. Both dictionaries
include the beginner instructions, live explanations and imagined milestone labels.
