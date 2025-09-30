# GitHub Operational Checklist

This guide documents the repository automation that backs the "quick actions" roll-out. Use it as a runbook when configuring GitHub for SommOS.

## 1. GitHub Environments & Secrets

Create two environments in the repository settings:

| Environment | Purpose | Required Secrets/Variables |
| --- | --- | --- |
| `staging` | Preview deployments, integration testing. | `OPENAI_API_KEY`, `SESSION_SECRET`, `JWT_SECRET`, `OPEN_METEO_BASE` (if overriding default), `WEATHER_API_KEY` (optional). |
| `production` | Live deployments for vessel operations. | Same as staging plus any analytics or monitoring keys (e.g., `SENTRY_DSN`). |

Tips:

- Generate unique `SESSION_SECRET` and `JWT_SECRET` values per environment using `npm run generate:secrets`.
- Store `DATABASE_PATH` as an environment variable or repository variable if your deployment pipeline needs it. Keep file paths consistent with the Docker image (`/app/data/sommos.db`).
- Mark secrets required by workflows so GitHub blocks deployments without them.

## 2. Branch Protection

Protect the `main` branch with the following rules:

1. Require pull request reviews (at least one approval).
2. Require status checks to pass before merging:
   - `ci` (continuous integration suite).
   - `spec-parity` (OpenAPI parity verification).
3. Enforce branch up to date with `main` before merging.
4. Restrict who can push directly to `main` to the release engineering team.

## 3. Environment Contract

- `.env.example` now mirrors `backend/config/env.js`. Copy it when bootstrapping local development and adjust secrets as needed.
- The Docker image no longer expects a bundled `.env` file; inject secrets at runtime through environment variables or secrets managers.

## 4. API Specification Guardrails

- The canonical API contract lives in `backend/api/openapi.yaml`.
- The CI job `spec-parity` runs `npm run spec:parity` to ensure every Express route is captured in the OpenAPI document (and vice versa).
- When adding routes, update the spec file before opening a pull request to keep the job green.

## 5. Build Artifacts & SBOM

- CI produces frontend build artifacts (`frontend/build`) and a CycloneDX SBOM at `build/sbom.json`. Both are uploaded as GitHub Actions artifacts for traceability.
- To generate the SBOM locally run `npm run sbom:generate`.

## 6. Dependency & Security Automation

- Dependabot (`.github/dependabot.yml`) monitors npm dependencies in the root and `frontend/` workspace with weekly updates.
- CodeQL (`.github/workflows/codeql.yml`) scans the JavaScript/TypeScript stack on pushes and pull requests targeting `main`.

Keep this document close when onboarding new operators or rotating responsibilities within the crew.
