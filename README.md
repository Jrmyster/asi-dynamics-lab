# ASI Dynamics Lab

**An offline, interactive system-dynamics sandbox for hypothetical artificial superintelligence.** Explore recursive improvement, alignment drift, shared compute, and energy constraints through transparent equations.

This project is a complete static dashboard. It contains no actual AI model, autonomous agent, external API, account system, or telemetry. Its capability and stability indices are invented teaching variables; they are not empirical forecasts or safety certifications. Software readiness does not establish scientific validity.

## Quick start

1. Extract `asi-dynamics-lab.zip`.
2. Open `asi-dynamics-lab/index.html` in a current desktop or mobile browser.
3. Select a scenario or adjust parameters. Press **Run simulation** or **+1 hour**.

No package installation, build step, server, API key, or internet connection is required to run the dashboard. Classic scripts are used deliberately so `file://` loading works. The separate `asi-dynamics-lab-standalone.html` download embeds the same app and its documentation in one file.

For an optional local HTTP server, run from the extracted repository:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`. On systems where Python is named `python3`, use that command instead. Stop the server with Ctrl+C.

## Features

- Total compute allocation: 1–1,000,000 TFLOPS, shared across 1–100 nodes.
- Recursive improvement coefficient α: 0–0.3 per model hour.
- Guardrail strength: 0–100%, with explicit assumed control costs and benefits.
- Three capability trajectories displayed together on a logarithmic chart.
- Selectable active hypothesis for node drift and illustrative domain milestones.
- Mean and weakest-node stability, with 70-point and 40-point warning thresholds.
- Requested versus effective compute, power throttling, cumulative kWh, and an explicitly conditional bit-erasure lower bound.
- Safety patches, compute scaling, and temporary recursive-learning boosts.
- Three initial-condition presets; pause, step, reset, and a 120-hour stopping horizon.
- Seeded, reproducible node sensitivities and timestamped intervention records.
- CSV trajectories and complete JSON scenario exports, including actions and initial conditions.
- Responsive dark interface, keyboard controls, focus indicators, screen-reader summaries, and reduced-motion support.
- Built-in Node tests and a GitHub Actions workflow that verifies changes before publishing to Pages.

## Repository contents

| File | Purpose |
| --- | --- |
| `index.html` | Semantic dashboard and inline model notes |
| `simulation.js` | Independent mathematical engine; browser and CommonJS compatible |
| `i18n.js` | English/Khmer dictionaries, language preference and text updates |
| `app.js` | Controls, canvas charts, status updates, and exports |
| `styles.css` | Responsive dark UI; optional Noto Sans Khmer web font |
| `EXPLANATION.md` | Theory, complete equations, limits, and primary-source references |
| `tests/simulation.test.cjs` | Determinism, physical constraints, drift, interventions, and export tests |
| `scripts/build.py` | Standard-library staging and standalone packaging |
| `.github/workflows/deploy.yml` | Pull-request validation and main-branch GitHub Pages deployment |
| `.gitignore` | Excludes generated builds and local artifacts |
| `LICENSE` | MIT license |

## How the model works

Every curve starts at capability **K = 1**. Compute, coordination, guardrails, and interventions determine a common learning coefficient. Sub-linear, exponential, and positive-feedback growth hypotheses are evolved together. Alignment follows the selected hypothesis, using separate node states with fixed seeded sensitivity.

The cluster draws power at a fixed assumed efficiency. Allocations exceeding the facility budget are throttled before affecting capability. Total compute is never multiplied by node count. Domain labels are arbitrary threshold annotations; this app performs no science or governance work.

The fixed integration interval is 0.05 model hours. Playback advances 0.5 model hours every 100 milliseconds of visible foreground time, nominally 5 model hours per real second. A hidden tab pauses automatically. Model hours have no calibrated mapping to real ASI development time. The 0.5/hour log-rate ceiling and 10¹² capability ceiling prevent numerical runaway; they are computational modeling choices.

Controls change existing state immediately. **Reset** applies current controls as new initial conditions. Presets reset state. Changing active hypotheses keeps their existing trajectories and node states, so use reset when comparing clean scenarios. All curves share the same exogenous inputs; their plotted trajectories are alternative hypotheses, not three concurrently consuming clusters.

Milestone crossings remain in the run's log even if you later change the active hypothesis. Hover the milestone status to see which hypothesis first crossed it. An achieved status records history, whereas the progress bar reflects the current hypothesis.

Exports are snapshots when clicked. CSV records each fixed-step state; multiple interventions at one tick overwrite that tick's CSV row. JSON preserves the action sequence, so it can reconstruct all interventions with the engine. The on-screen event list retains the latest 64 messages; JSON actions remain complete.

Read [EXPLANATION.md](EXPLANATION.md) before using the results in a presentation or argument.

## Verification and packaging

Node.js 24 and Python 3.10+ are development/CI tools only. The running website does not depend on them.

```bash
node --check simulation.js
node --check app.js
node --check i18n.js
node --test tests/*.test.cjs
python scripts/build.py
```

The packaging command copies public files to `dist/` and writes `dist/asi-dynamics-lab-standalone.html`. It does not modify source files. `dist/` is ignored by Git. `python3` may be used in place of `python`.

## Initialize and push with Git Bash

Create a new **empty** repository named `asi-dynamics-lab` at `https://github.com/new`. For the simplest Pages setup, choose Public and do not pre-create a README, license, or `.gitignore`; these already exist here.

The following remote uses Jared's account `Jrmyster`. If you are using another account, change the account name in the remote URL. Authentication is handled by Git Credential Manager or your existing GitHub setup; do not put tokens in the URL.

From the directory containing the extracted folder:

```bash
cd asi-dynamics-lab
git init
git branch -M main
git add .
git commit -m "feat: add ASI dynamics simulation and GitHub Pages deployment"
git remote add origin https://github.com/Jrmyster/asi-dynamics-lab.git
git push -u origin main
```

If Git requires an author identity, configure your own name and email, then repeat the commit. No GitHub repository is created by `git remote add`, so complete the empty-repository step first.

For subsequent updates:

```bash
git add .
git commit -m "Update simulation dashboard"
git push
```

## Enable automatic GitHub Pages deployment

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Open **Actions → Validate and deploy Pages → Run workflow**, selecting `main`. If an earlier run failed before Pages was enabled, rerun it now.
4. Wait for validation and deployment to finish. The `github-pages` deployment environment and job summary report the published URL.

For the repository name above, the usual URL is `https://jrmyster.github.io/asi-dynamics-lab/`. It becomes available only after successful deployment.

Pushes to `main` deploy automatically. Pull requests targeting `main` run syntax checks, model tests, and staging without deployment or Pages-write permissions. The workflow stages only public app assets and documentation; Git internals and tests are excluded. No custom repository secrets are required. Pages environment approval rules, repository policy, plan restrictions, or disabled Actions may still block deployment.

Official workflow guidance: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Architecture and maintenance

The engine has no DOM access and can be tested without a browser. UI code uses local program resources, an optional external web font, and `textContent` for model text, with no evaluation of user-supplied code or untrusted HTML. Runtime exports are generated in memory with Blob URLs and revoked after download. Model state is not persisted: reloading initializes defaults. The language preference alone is saved in local storage when available. Downloads remain on the user's device until they choose to share them.

Constants and thresholds live in `simulation.js`; update the matching equations in `EXPLANATION.md` whenever changing them. The GitHub workflow uses official action major-version tags for maintainability. Teams requiring immutable action revisions can replace those tags with reviewed commit SHAs.

No formal accessibility certification or exhaustive cross-browser compatibility claim is made. The interface is designed for current Chromium, Firefox, and Safari with canvas, classic scripts, and Blob downloads. Sandboxed document viewers may block JavaScript or downloads; open the extracted HTML in a normal browser in that case.

## License

MIT. See [LICENSE](LICENSE).

## English / Khmer dashboard

Choose **EN** or **ខ្មែរ** in the navigation bar. The switch updates dashboard text,
metric descriptions, warning states, event logs, chart descriptions, domain names,
and screen reader announcements without resetting or advancing the model. Your
choice is remembered in local storage when the browser permits it. The default is
English; blocked storage does not prevent switching.

`i18n.js` contains the complete translation dictionaries and named interpolation.
Static labels use `data-i18n`; accessible names and metadata use
`data-i18n-aria-label` and `data-i18n-content`. `app.js` listens for `i18n:change`
and refreshes presentation from the existing snapshot. Engine events retain stable
translation keys alongside English messages. Export identifiers, scientific units,
and numerical precision remain independent of the selected language.

Noto Sans Khmer is loaded from Google Fonts when a connection is available. System
fonts provide an offline fallback. Google Fonts is an optional external request;
no account or analytics are used. The theoretical paper and repository documentation
remain in English. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for update instructions.

Validate the full suite with `node --test tests/*.test.cjs`. Run
`python3 scripts/build.py` to stage the Pages site and a single-file dashboard.
