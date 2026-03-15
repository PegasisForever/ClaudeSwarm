# ClaudeSwarm Monorepo Template

Full-stack Bun monorepo built with Turborepo.

## Stack

- Backend: Bun, `Bun.serve`, tRPC, TypeScript, `trpc-bun-adapter`
- Frontend: Vite, React, React Router, TypeScript, Tailwind CSS v4
- Tooling: Bun workspaces, Turborepo, Prettier, TypeScript, ESLint v9

## Structure

```text
apps/
  backend/
  frontend/
```

The frontend imports `AppRouter` as a type directly from `@repo/backend/router`, which follows the tRPC recommendation to use `import type` from the server router module so nothing server-side is bundled into the client.

## Template Behavior

The frontend is intentionally minimal:

- `/` renders a `Home` page
- `/about` renders an `About` page
- a small nav bar links between the two pages
- each page has a title and a button

Both buttons call the same tRPC mutation, `logPage`, with either `"home"` or `"about"`.

The backend logs the clicked page with `console.log`.

## Commands

Run everything from the repository root:

```bash
bun run dev
bun run build
bun run format
bun run type-check-lint
```

## Development

`bun run dev` starts:

- the backend on `http://127.0.0.1:3000`
- the Vite dev server on `http://127.0.0.1:4100`

The backend owns the public app port and forwards non-API requests to Vite during development. API requests stay on the backend under `/api/trpc` and `/api/health`.

React Router runs in the frontend, and the backend is set up to support SPA deep links like `/about`.

## Production Build

`bun run build` builds a Docker image named `claudeswarm-monorepo`.

Inside the image:

- the frontend is built with Vite
- the backend is bundled with Bun
- the backend serves the built frontend files at runtime

Run the container manually:


## Notes

- The backend uses [`trpc-bun-adapter`](https://github.com/cah4a/trpc-bun-adapter).
- The frontend uses a relative tRPC URL (`/api/trpc`), so browser requests go through the backend in both development and production.
- In production, the backend serves the built frontend and returns the SPA shell for browser navigation requests.

## Start

```bash
docker run -d -e PORT=14000 --network host -v /var/run/docker.sock:/var/run/docker.sock pegasis0/claude-swarm:latest
```

And navigate to `http://localhost:14000` to access the frontend.