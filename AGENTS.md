# Repository instructions

## Commits

- Start every commit subject with one of: `ADDED:`, `UPDATED:`, `CHANGED:`, `DELETED:`, or `FIXED:`.
- Follow the prefix with a concise English description of the work.
- Group related changes into substantial, cohesive commits. Avoid many commits for small changes.
- Never commit credentials, private environment files, dependencies, or generated build output. Keep `.env.example` free of secrets.

## Package manager

- Use Yarn 1.22.22 for dependency management and project scripts.
- Keep `yarn.lock` committed and use `yarn install --frozen-lockfile` for reproducible installs.
- Do not use npm or commit `package-lock.json`.
