# Custom Markdown components

The registry in `quartz/elements/index.tsx` is the source of truth for custom tags in posts. To add or change a tag, use the repo-local [create-component skill](.agents/skills/create-component/SKILL.md). This is the Markdown element system, distinct from page-layout components in `quartz/components`.

Definitions include authoring metadata, prop schemas, renderers, and optional styles. Keep examples executable and describe custom validation constraints explicitly. See [Markdown elements](docs/features/Markdown%20elements.md) for the syntax and content modes.

After component changes, run `npm run elements:sync` and `npm run elements:check`. Generated `.authoring/elements.md` and `.authoring/elements.json` belong to the separate `content` Git repository; commit those changes there before updating its submodule pointer in Quartz when commits are requested. Regeneration only writes local files; it does not commit, push, or publish.

`npm run elements:sync -- --content /path/to/quartz-content` targets a standalone checkout. For content authoring, read `content/AGENTS.md` and its component catalog. Catalog fingerprints identify source snapshots, not deployment status. New component usage must be coordinated with the renderer release.
