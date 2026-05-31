# DB Folder

This folder is for durable database artifacts (SQLite schema migrations, seed SQL, and index evolution notes).

Current authoritative spec is in:

- `docs/backend/SPEC.md` (sections: Database Schema + Indexes, Vector DB)

Recommended next step:

- Add migration files (e.g. `001_init.sql`, `002_duplicate_candidates.sql`) that implement the target schema from `docs/backend/SPEC.md`.
