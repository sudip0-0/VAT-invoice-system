# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the app code. Use `src/pages` for route-level screens, `src/components` for reusable UI and feature components, `src/hooks` for data and state hooks, `src/contexts` for providers, `src/lib` for utilities, and `src/integrations/supabase` for the client and generated types. Keep tests in `src/test` or colocated as `*.test.ts(x)`. Static assets live in `public/`. Database changes belong in `supabase/migrations/` as timestamped SQL files.

## Build, Test, and Development Commands
Install dependencies with `npm install`.

- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production bundle in `dist/`.
- `npm run build:dev` builds with development mode settings.
- `npm run preview` serves the built app locally.
- `npm run lint` runs ESLint across the repo.
- `npm test` runs Vitest once in `jsdom`.
- `npm run test:watch` starts Vitest in watch mode.

## Coding Style & Naming Conventions
This project uses TypeScript, React, Tailwind CSS, and shadcn/ui. Follow the existing style: 2-space indentation, semicolons, and double quotes. Prefer the `@/` alias over long relative imports. Use `PascalCase` for React components and page files such as `InvoiceCreatePage.tsx`, `camelCase` for hooks beginning with `use`, and `kebab-case` for utility filenames in `src/lib`. Keep generated shadcn primitives in `src/components/ui` using their current lowercase filenames. Linting is defined in `eslint.config.js`; there is no separate Prettier config in this repo.

## Testing Guidelines
Vitest is configured in `vitest.config.ts` with Testing Library and setup from `src/test/setup.ts`. Name tests `*.test.ts` or `*.spec.ts` under `src/`. Add tests for business logic, hooks, auth flows, and invoice/payment calculations when behavior changes. Run `npm test` and `npm run lint` before opening a PR.

## Commit & Pull Request Guidelines
Recent history mixes clear commits like `Fix vendor payments logic` with vague ones like `Changes`. Prefer short, imperative commit subjects that describe the behavior change. For pull requests, include a summary, validation steps, linked issues, and screenshots for UI or print-layout updates. If a change affects Supabase schema or environment variables, call that out explicitly and include the migration file name.

## Security & Configuration Tips
Keep secrets in local environment files and do not commit credentials. When changing database schema, add a new migration in `supabase/migrations/` instead of rewriting an existing applied migration.

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