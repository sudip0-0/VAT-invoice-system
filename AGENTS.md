# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the app code. Use `src/pages` for route-level screens, `src/components` for reusable UI and feature components, `src/hooks` for data and state hooks, `src/contexts` for providers, `src/lib` for utilities, and `src/integrations/local-db` for the desktop database adapter and generated-style types. Keep tests in `src/test` or colocated as `*.test.ts(x)`. Static assets live in `public/`. Database schema and index changes belong in `electron/db/schema.sql`.

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run dev` starts the Vite renderer dev server only.
- `npm run dev:renderer` also starts the renderer dev server only; use this when debugging the React UI without Electron.
- `npm run dev:desktop` starts the Electron desktop app against a local Vite renderer. This is the main command for desktop development.
- `npm run build` creates the production renderer bundle in `dist/`.
- `npm run build:dev` builds the renderer with development mode settings.
- `npm run build:desktop` builds the renderer and packages the Windows Electron app into `release/`.
- `npm run preview` serves the built renderer locally for quick browser checks.
- `npm run preview:desktop` opens Electron against the current local app entrypoint; use this only after a renderer build exists.
- `npm run lint` runs ESLint across the repo.
- `npm test` runs Vitest once in `jsdom`.
- `npm run test:watch` starts Vitest in watch mode.
- `npx tsc --noEmit` runs a TypeScript type check without generating files.

### Quality score gates (SCORECARD.md)

Before advancing a remediation wave, run all three and confirm `SCORECARD.md` evidence is updated:

```sh
npm test
npm run lint
npx tsc --noEmit
```

Technical proxies for score items live under `src/test/score-gates/`. Soft criteria (docs tone, a11y spot checks) are recorded manually in `SCORECARD.md`.

Useful desktop-specific notes:

- For normal feature work on the desktop app, prefer `npm run dev:desktop` over opening `127.0.0.1` in a browser.
- `npm run build:desktop` produces the installer and unpacked app under `release/`.
- If you need to force a different dev port for Electron + Vite, use PowerShell like `$env:VITE_DEV_PORT=8085; npm run dev:desktop`.
- The packaged window uses `minWidth: 1200` (desktop-first). Mobile drawer styles exist for narrower renderer debugging, but production UX targets desktop.

## Coding Style & Naming Conventions
This project uses TypeScript, React, Tailwind CSS, and shadcn/ui. Follow the existing style: 2-space indentation, semicolons, and double quotes. Prefer the `@/` alias over long relative imports. Use `PascalCase` for React components and page files such as `InvoiceCreatePage.tsx`, `camelCase` for hooks beginning with `use`, and `kebab-case` for utility filenames in `src/lib`. Keep generated shadcn primitives in `src/components/ui` using their current lowercase filenames. Linting is defined in `eslint.config.js`; there is no separate Prettier config in this repo.

## Testing Guidelines
Vitest is configured in `vitest.config.ts` with Testing Library and setup from `src/test/setup.ts`. Name tests `*.test.ts` or `*.spec.ts` under `src/`. Add tests for business logic, hooks, auth flows, and invoice/payment calculations when behavior changes. Run `npm test` and `npm run lint` before opening a PR.

## Commit & Pull Request Guidelines
Recent history mixes clear commits like `Fix vendor payments logic` with vague ones like `Changes`. Prefer short, imperative commit subjects that describe the behavior change. For pull requests, include a summary, validation steps, linked issues, and screenshots for UI or print-layout updates. If a change affects the local database schema or environment variables, call that out explicitly.

## Security & Configuration Tips
Keep secrets in local environment files and do not commit credentials. When changing database schema for the desktop app, update `electron/db/schema.sql` and keep it SQLite-compatible.

## Behavioral guidelines to reduce common LLM coding mistakes.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
