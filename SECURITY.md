# SommOS Security Guide

## Overview
SommOS handles sensitive data such as authentication secrets and third-party API keys. This guide summarizes how the project protects those values across development, CI, and production deployments.

## Secrets
Our secrets policy ensures no credentials are committed to the repository and that every runtime loads configuration from the environment.

### Sources of truth
- **Local development**: Copy `.env.secrets-template` to `.env.local` (or another ignored file) and fill in the required values. Never commit the populated file.
- **Continuous integration**: Define the same keys as repository or environment secrets in GitHub Actions. Use workflows to export them as environment variables; do not write them to disk inside the runner.
- **Production deployments**: Provision secrets in the hosting platform (e.g., container orchestrator, PaaS). Runtime configuration is injected via environment variables consumed by `backend/config/env.js`.

### Required keys
The backend fails fast at startup if critical secrets are missing in production:
- `PORT`
- `NODE_ENV`
- `OPEN_METEO_BASE`
- `SESSION_SECRET`
- `JWT_SECRET`
- `DEEPSEEK_API_KEY` or `OPENAI_API_KEY` (when AI features are enabled)
- `WEATHER_API_KEY` (for external weather integrations)

The configuration loader validates these values with Zod, providing human-readable errors and preventing the app from running with invalid input.

### Authentication bypass for development
- A development convenience flag `SOMMOS_AUTH_DISABLED=true` fully disables authentication and role checks.
- This mode sets every request as an anonymous admin user.
- Use only for local development and demos. Never enable in production environments.

### Rotation and incident response
1. **Plan the change**: Identify impacted environments (local, CI, production) and notify stakeholders.
2. **Generate the replacement secret** using the provider’s dashboard or CLI.
3. **Update storage**:
   - Local: refresh your ignored `.env.*` file.
   - CI: update the repository or environment secret in GitHub.
   - Production: update the platform’s environment variable store.
4. **Deploy and validate**:
   - Run `node scripts/verify-environment.js` locally or in CI to confirm the new values satisfy schema validation before deployment.
   - Redeploy the service so the new environment variables take effect.
5. **Revoke the previous secret** once functionality is verified.
6. **Document the rotation** in the incident or maintenance log, including date, owner, and follow-up actions.

### Storage and handling rules
- Secrets must only live in environment variable stores or encrypted secret managers.
- `.gitignore` prevents `.env*` files (except templates) from being tracked; verify with `git status` before committing.
- Avoid echoing secrets to logs or error messages. The backend only logs whether values are present, never the values themselves.
- Prefer short TTL keys or scoped tokens where supported.

### Auditing
- Review GitHub organization audit logs and cloud platform access logs quarterly.
- Automate secret scanning in CI to detect accidental disclosure.
- Rotate credentials immediately if a leak is suspected and follow the rotation process above.

## Additional safeguards
- Enforce multi-factor authentication for all maintainers.
- Require code review on protected branches.
- Keep dependencies patched by monitoring `npm audit` and GitHub Dependabot alerts.
- Run `npm run lint` and the test suite in CI to catch regressions before release.

## Reporting vulnerabilities
If you discover a vulnerability, email the maintainers via the contact information in `README.md`. Provide reproduction steps, affected components, and any mitigation ideas. We aim to acknowledge reports within two business days.
