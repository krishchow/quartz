---
name: create-component
description: Create or extend reusable custom Markdown elements in this Quartz repo, including XML props, nested content, static rendering, styles, validation, and the synced quartz-content authoring catalog. Use for new tags or changes to their contract; page-layout components use a separate system.
---

# Create a Markdown component

Build the element the user described using the registry at `quartz/elements/index.tsx`. Work from the repository root. Read `quartz/elements/types.ts` and the closest existing definition; `Badge` is a simple inline element and `Map`/`Point` demonstrates structured child data. Read `docs/features/Markdown elements.md` for the XML syntax and content modes.

## Choose the contract

Decide the tag name, whether its output is inline or block markup, its prop schema, and its children. Infer routine details from the request and existing components; clarify only decisions that materially change the requested behavior.

Use the smallest fitting content mode:

- `none`: props only, the default.
- `text`: literal XML-decoded text passed as the renderer's second argument.
- `html`: XML markup and registered components passed as rendered children.
- `markdown`: standard Markdown and GFM children; no Obsidian extensions inside the children.
- `data`: child definitions passed through the renderer's third argument, `{ elements }`. Each child is `{ name, props, elements }`. Declare `childElements` to restrict the parent's children; declare `dataOnly: true` and `parents` on children that describe data rather than render independently.

Props support `string`, `number`, `boolean`, and `json`, with required/default values. Numbers support `min`, `max`, and `integer`. Use `validate(props)` for additional checks, such as JSON structure. Errors should explain the expected value; the pipeline attaches source locations.

## Implement and describe

Put substantial definitions in their own `.tsx` module under `quartz/elements/`, then register them in `index.tsx`. Use static JSX and class-scoped CSS with Quartz theme variables. Render props through JSX so text and attributes are escaped. The system renders at build time; hooks, event-handler props, and hydration do not provide browser behavior. If the requested component needs browser interaction, identify that extra scope rather than silently producing a nonfunctional control.

Authoring metadata belongs beside the definition:

- `description`: when and why an author would use the element.
- `examples`: executable XML examples, including the parent when documenting a data-only child.
- A `description` for every prop.
- `constraints`: human-readable rules enforced by a custom `validate()` callback. Required when a custom validator exists.
- `notes`: important behavior such as external resources, fallback behavior, or block placement.

Use strict XML in examples: quoted values even for numbers and booleans, entity escaping, and properly closed tags. Use JSON inside a quoted attribute for structured props. Do not introduce JavaScript expressions, spread props, or callbacks into the parser to accommodate one component.

## Verify and sync

Exercise the element through the Markdown pipeline in `quartz/elements/elements.test.tsx`, covering the rendered result and meaningful invalid input or child relationships. Add focused tests for nontrivial layout or transformation logic. Run the relevant tests, formatting checks, and a Quartz build when markup or stylesheet integration changes. Report unrelated baseline failures separately.

After the final source edits and formatting, run:

```sh
npm run elements:sync
npm run elements:check
npm test
```

The generator validates metadata and examples, then writes `content/.authoring/elements.md` and `elements.json`. Do not edit generated files manually. Their fingerprint includes element source files, so run sync again after changing source or formatting. To update a standalone checkout instead, pass `-- --content /path/to/quartz-content` to the sync and check commands.

Check both Git working trees. Catalogs are tracked in `quartz-content`, a separate repository. When commits are requested, commit the content changes before updating the submodule pointer in Quartz. Generating catalogs does not authorize commits, pushes, PRs, or deployment. Keep new content usage coordinated with the renderer release; the fingerprint identifies a source snapshot and does not prove it is deployed.

Finish with the usable Markdown syntax, files changed, checks performed, and any limits that affect authors.
