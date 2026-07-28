# Overview

A customized fork of Quartz v4 (static site generator for digital gardens). Site content lives in `content/` and project documentation in `docs/`. The "Docs site" workflow serves the docs with `npx quartz build --serve -d docs --port 5000`.

Notable customizations:
- `FolderIndex` component (`quartz/components/FolderIndex.tsx`): build-time nested listing of all descendant pages of the current folder. Draft pages (`draft: true`) appear as unlinked "coming soon" entries with a draft badge and hint text, but are never emitted.
- Filter pipeline (`quartz/processors/filter.ts`) records lightweight metadata for filtered-out files on `ctx.filteredMeta` (see `quartz/util/ctx.ts`), so components can list drafts without publishing them.
- Frontmatter supports a `hint` (alias `subtitle`) field for listing subtitles, falling back to `description`.

# User preferences

(none recorded yet)
