# AGENTS.md — Labs64.IO :: Documentation

Guidance for AI agents working in this repository. Read this before making changes.

## What this project is

The **ultimate documentation reference** for users who want to run, use, and configure Labs64.IO Ecosystem modules — plus the technical/contributor reference. Organized by module with Markdown files, built as a Jekyll site on the [just-the-docs](https://just-the-docs.com) theme (consumed as a gem, not vendored — see `Gemfile`).

## Repository layout

| Path | Purpose |
|------|---------|
| `checkout/` | Checkout module documentation |
| `payment-gateway/` | Payment Gateway documentation |
| `auditflow/` | AuditFlow documentation |
| `auth-gateway/` | Auth Gateway documentation |
| `customer-portal/` | Customer Portal documentation |
| `architecture.md` | Architecture documentation |
| `getting-started.md` | Adopter guide — run one module, the whole ecosystem, or your own cluster; then configure a module |
| `contributing.md` | Contributor guide — build/test a module, OpenAPI-first workflow |
| `index.md` | Jekyll home page (distinct from `README.md`, which is GitHub-only and excluded from the build) |
| `_config.yml`, `Gemfile` | Site/theme configuration |
| `_sass/color_schemes/labs64.scss` | Labs64 brand color overrides |
| `Dockerfile`, `docker-compose.yml`, `justfile` | Local preview, same Docker-first workflow as `labs64.io-website` — `just serve`, then http://localhost:4000/docs/ |

## Critical guardrails

1. **Each repo has its own git history** — do not cross-commit between repositories.
2. **This repo owns technical reference and onboarding — not marketing.** It is the ultimate documentation reference for users who want to run, use, and configure Labs64.IO Ecosystem modules (`getting-started.md`) as well as the technical/contributor reference (`contributing.md`, module pages, `architecture.md`). `labs64.io-website` owns marketing and positioning only — its `/get-started/` page is a teaser that should link here, not a competing source of onboarding steps. If you find onboarding content duplicated on the website, flag it — don't extend the duplication.
3. **Don't restate module status or version in page content.** The single source of truth is `labs64.io-website/_data/modules.yml`, published on the website. Pages here describe how to *use* a module; maturity labels drift and belong in one place only.
4. **Write for someone adopting the module, in the present tense.** Describe what a module does and how to configure it — not what is unfinished, planned, or under review. Two exceptions that must always stay, stated plainly and without apology:
   - **Anything with a security or financial consequence** (for example: an endpoint whose authenticity isn't verified, a default that is unsafe in production). Put it in a "Before you go live" checklist as a deployment responsibility — never delete it to make a page read as more finished.
   - **Capabilities that do not exist.** Never document an API, endpoint, or component a user cannot actually call; scope the page to what ships instead.
5. **Module directory names must match the module `id` in `labs64.io-website/_data/modules.yml`** (`checkout/`, `payment-gateway/`, `auditflow/`, `auth-gateway/`, `customer-portal/`). Before adding docs for a new module, confirm it's already registered there — if it isn't, that's a `labs64.io-website` change (see its `ecosystem-website-sync` skill), not just a docs addition.
6. **This site is served at `labs64.io/docs`** (`baseurl: "/docs"` in `_config.yml`), not a standalone domain. Use Jekyll's `relative_url` / root-relative links for internal navigation — don't hardcode absolute `https://labs64.io/...` URLs for pages inside this repo.
7. **Documentation should be accurate and up-to-date** with the codebase.

## Conventions

- Documentation is written in Markdown, organized by module directory.
- Keep documentation consistent with the actual codebase behavior.
- **Each module page is `<module>/README.md` with `permalink: /<module>/`.** The filename keeps it rendering when browsing the repo on GitHub; the permalink is what makes `labs64.io/docs/<module>/` serve the page instead of a directory listing. A new module page needs both.
- **Cross-link with relative `.md` paths** (`./quickstart.md`, `../getting-started.md`). `jekyll-relative-links` rewrites them to built URLs at publish time, so the same link works both on GitHub and on the site. Hand-written `.html` links work on the site but break on GitHub.
- Module pages follow a consistent shape so readers learn it once: what it does → key capabilities → start here → API contract → configure → extend → operate → next steps.

## Verifying links

Both link bugs this repo has hit — `.md` links 404ing on the published site, and module directories serving a file listing — are invisible in the Markdown and only appear in the built output. After changing links or adding a page, build and crawl:

```bash
just build     # then check _site/ for href="...md" (should be none outside github.com links)
```

## Production deployment

`labs64.io/docs/*` is not served directly by this repo — it's a chain across three systems, none of them documented anywhere else. Read this before touching CI, `_config.yml`'s `url`/`baseurl`, or assuming `just build`'s output is what ships.

1. **`.github/workflows/pages.yml`** builds this repo with its own `Gemfile` (Jekyll 4.4, `just-the-docs`, `jekyll-relative-links`) and deploys via `actions/deploy-pages`. GitHub Pages' zero-config legacy builder (`actions/jekyll-build-pages`, GitHub-managed, no workflow file for it) **cannot** build this repo — it's pinned to the `github-pages` gem's Jekyll 3.10 / fixed theme set, which doesn't include `just-the-docs`. The repo's Pages source must be set to **GitHub Actions**, not "Deploy from a branch", or the legacy builder runs anyway and fails exactly like this did before `pages.yml` existed.
2. That deploys to this repo's own GitHub Pages URL: `io.labs64.com/labs64.io-docs/*` — GitHub nests every project repo without its own custom domain under the org's Pages custom domain (`io.labs64.com`) at a path equal to the repo name. This is **not** a page anyone links to; it only exists as CloudFront's origin.
3. **AWS CloudFront** (the `labs64.io` distribution — unmanaged by Terraform anywhere in this workspace, configured by hand in the AWS Console) has a `/docs` and a `/docs/*` cache behavior (two behaviors, not one `/docs*` — CloudFront path patterns are glob prefixes with no path-segment boundary, so `/docs*` would also match an unrelated `/docset-foo`). Both route to an origin `io.labs64.com` with Origin Path `/labs64.io-docs`, with **[`cloudfront/docs-path-rewrite.js`](./cloudfront/docs-path-rewrite.js)** attached as a viewer-request CloudFront Function. That function strips the `/docs` prefix from the incoming request *before* CloudFront prepends Origin Path — without it, `labs64.io/docs/foo` would forward to `io.labs64.com/labs64.io-docs/docs/foo` (Origin Path is always prepended to the original request URI; it does not strip whatever path pattern matched).
4. `_config.yml`'s `baseurl: "/docs"` matches step 3's public-facing path, **not** this repo's own raw GitHub Pages URL from step 2 — that mismatch is intentional. The raw `io.labs64.com/labs64.io-docs/*` URL is not meant to be browsed directly; if you visit it, internal links will 404 (they point at `/docs/...`). Don't “fix” this by changing `baseurl` — it would break the real, CloudFront-fronted production URL instead.

If any of this changes (repo renamed, CloudFront reconfigured, Pages source flipped), update this section — it's the only place any of it is written down.

## Local development and verification

Docker-first, same workflow as `labs64.io-website` — never invoke `bundle` directly on this machine.

```bash
just serve    # start the dev server at http://localhost:4000/docs/
just doctor   # Jekyll diagnostics
just build    # one-off production build (verify before commit)
just down     # stop the background service
```

## Site engine & customization

- For anything about how the site/theme behaves, reference the [just-the-docs documentation](https://just-the-docs.com) first.
- For any Labs64 brand customization request specifically, reference [just-the-docs.com/docs/customization/](https://just-the-docs.com/docs/customization/) and use the same style already established (see `_sass/color_schemes/labs64.scss`).
- **Always prefer the theme's built-in customization options** (config keys in `_config.yml`, `_sass/color_schemes/*.scss`, `_sass/custom/setup.scss`/`custom.scss`, the `*_custom.html` include overrides) **over hand-written CSS/HTML.**
- Only write custom code when the theme has no supported override point for it, and keep it inside those same supported override files — never edit theme internals directly. This keeps upgrading `just-the-docs` a one-line `Gemfile` bump.
- **Never use `//` line comments inside `<script>` blocks in `.html` includes** (e.g. `_includes/head_custom.html`). This theme's layout collapses rendered HTML onto very few physical lines, so a `//` comment silently swallows everything after it on the line — including the rest of the script — with no build error. Use `/* ... */` block comments instead. (This is what made the Mermaid fullscreen click handler silently no-op the first time it was added — verify any new inline script by checking `_site/<page>.html` renders it as executable code, not swallowed by a comment.)
