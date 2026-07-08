# Glossary — Manual Entries

Maintain this file by hand. Add, edit, or remove rows directly.

The monitor script (`scripts/glossary_monitor.py`) merges these entries with
AI-generated ones and writes the combined, alphabetically sorted result to
`GLOSSARY.md`. Do not edit `GLOSSARY.md` directly — it is regenerated on every run.

If a term exists in both this file and the AI-generated source, this file wins.

**Context column:** use plain module names (e.g. `Checkout, Payment Gateway`).
The build script resolves them to links automatically.

| Term | Context | Definition |
|------|---------|------------|
| **JWT (JSON Web Token)** | Checkout, Payment Gateway | A signed token used to authenticate and authorize API requests. The tenant identity is derived from the JWT payload. |
