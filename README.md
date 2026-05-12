# lexshift

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Hono, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Hono** - Lightweight, performant server framework
- **Node.js** - Runtime environment
- **Biome** - Linting and formatting
- **Starlight** - Documentation site with Astro
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm dev
```

The API is running at [http://localhost:3000](http://localhost:3000).

## Git Hooks and Formatting

- Format and lint fix: `pnpm check`

## Project Structure

```
lexshift/
├── apps/
│   ├── docs/        # Documentation site (Astro Starlight)
│   └── server/      # Backend API (Hono)
├── packages/
```

## Available Scripts

- `pnpm dev`: Start all applications in development mode
- `pnpm build`: Build all applications
- `pnpm dev:server`: Start only the server
- `pnpm check-types`: Check TypeScript types across all apps
- `pnpm check`: Run Biome formatting and linting
- `cd apps/docs && pnpm dev`: Start documentation site
- `cd apps/docs && pnpm build`: Build documentation site
