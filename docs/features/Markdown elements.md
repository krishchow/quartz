---
title: Markdown elements
---

Embed registered, static UI elements directly in Markdown using capitalized, self-closing tags:

```md
A status: <Badge text="Work in progress" />

<Badge
  text="Reading notes"
/>
```

`Plugin.MarkdownElements()` is enabled in `quartz.config.ts` before the Obsidian and GitHub Markdown transformers. Ordinary lowercase HTML still works. Code fences, inline code, escaped tags, and HTML comments are left alone.

## Define an element

Add a definition to `quartz/elements/index.tsx`. Each definition declares its prop schema, a build-time JSX renderer, and optional CSS:

```tsx
InfoCard: {
  props: {
    title: { type: "string", required: true },
    description: { type: "string", required: true },
  },
  render: ({ title, description }) => (
    <aside class="info-card">
      <strong>{String(title)}</strong>
      <p>{String(description)}</p>
    </aside>
  ),
  css: `
    .info-card {
      padding: 1rem;
      border: 1px solid var(--lightgray);
      border-radius: .5rem;
      background: var(--highlight);
    }
  `,
},
```

Then use it on its own line, with blank lines around it:

```md
<InfoCard title="Reading notes" description="Some context…" />
```

Use inline elements such as spans within paragraphs. Elements that produce blocks, such as an aside or div, belong in standalone blocks. CSS is global and bundled once with the site stylesheet, including styles for registered elements that a particular page does not use. Scope selectors to the element's class and use Quartz's theme variables for light and dark themes.

You can split definitions into separate files and import them into the registry. Alternatively, pass a replacement registry through `Plugin.MarkdownElements({ registry })`.

## Content modes

The registry sets each element's `content` mode. Authors can use either self-closing or paired tags; the definition decides which children are allowed.

| Mode             | Behavior                                                                                        |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| `none` (default) | Props only; rejects non-whitespace children.                                                    |
| `text`           | Passes XML-decoded text to the renderer, preserving text whitespace. Nested markup is rejected. |
| `html`           | Renders XML markup and nested registered elements as children.                                  |
| `markdown`       | Renders children as GitHub-flavored Markdown, including nested registered elements and HTML.    |

For structured child data, use `content: "data"`. These children are validated and passed to the renderer's third argument as `{ elements }`, rather than rendered independently. A parent can restrict direct children with `childElements: ["Point"]`; child definitions can use `dataOnly: true` and `parents: ["Map"]`. Each validated child contains `{ name, props, elements }`, supporting nested data structures. See [[Static maps]] for a working example.

A definition receives its children as the second renderer argument:

```tsx
Panel: {
  props: { title: { type: "string", required: true } },
  content: "markdown",
  render: ({ title }, children) => (
    <aside class="panel">
      <strong>{String(title)}</strong>
      {children}
    </aside>
  ),
},
```

```md
<Panel title="Reading notes">

**An observation**, with a status: <Badge text="Draft" />

- First point
- Second point

</Panel>
```

Markdown mode supports standard Markdown and GFM, rather than Obsidian-specific syntax within the children. Nested elements are resolved before Markdown rendering. HTML mode uses well-formed XML markup: close void tags such as `<img src="..." />` and `<br />`. Ordinary HTML outside registered elements keeps the usual Markdown/HTML rules.

For literal text or Markdown containing XML-sensitive characters, CDATA avoids entity escaping:

````md
<Panel title="Code example"><![CDATA[

```html
<SomeExample value="anything" />
```

A & B can appear literally here.

]]></Panel>
````

CDATA is text, so element syntax inside CDATA does not invoke the registry. XML comments are ignored. XML processing instructions, DOCTYPE, and external entities are unsupported.

## Props and validation

The syntax is parsed by `saxes`, a strict XML parser. Attributes must use single or double quotes; whitespace around `=` and multiline tags are supported. XML entities are decoded: `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, and numeric references. Escape literal ampersands and angle brackets in attribute values and child text, or use CDATA for child text. Raw newlines and tabs inside attributes normalize to spaces according to XML rules; use `&#10;` for an explicit newline. Text children preserve whitespace, with XML line-ending normalization.

There is no JavaScript expression evaluation or JSX-style brace syntax. Boolean attributes require an explicit value.

| Schema type | Syntax                                | Renderer receives |
| ----------- | ------------------------------------- | ----------------- |
| `string`    | `title="Hello"`                       | String            |
| `number`    | `count="4"`                           | Finite number     |
| `boolean`   | `featured="true"`, `featured="false"` | Boolean           |
| `json`      | `items='["One", "Two"]'`              | Parsed JSON value |

Each prop can specify `required: true` or a `default`. Number schemas also support `min`, `max`, and `integer: true`. A definition can provide `validate(props)` for checks such as JSON shape validation; throw an error to report invalid values at the element’s source location. Optional props without defaults are omitted from the renderer's props object. Default objects are cloned for each instance. JSX escapes text and attribute values; avoid `dangerouslySetInnerHTML` for prop content.

Names must start with an uppercase ASCII letter and otherwise contain letters, numbers, underscores, dots, or hyphens. Capitalized tags are reserved for registered elements. Unknown elements, unknown or duplicate props, missing required props, invalid values, and malformed tags produce processing errors with the Markdown filename, line, and column.

Expression props, callbacks, and browser hydration are outside this static rendering system’s scope. Renderers run only at build time; React/Preact hooks and event handlers do not add browser behavior.

## Follow-up: linting and formatting

Standalone linting and auto-formatting are a follow-up. The shared parser is in `quartz/elements/parse.ts`, and the registry contains the validation schemas, so a lint command can use the same rules as rendering. A formatter should preserve quoted values, format multiline props consistently, and report invalid syntax without rewriting it.

## Authoring catalogs and agent guidance

The element registry is also the source for a generated authoring catalog in `quartz-content`:

- `.authoring/elements.md` lists syntax, examples, props, defaults, validation constraints, and parent/child rules.
- `.authoring/elements.json` exposes the same information for tooling, with a source fingerprint.
- `AGENTS.md` in the content repo points agents to those files, including when the repo is edited standalone. Its `create-page` skill uses the same catalog.

Each registered definition must provide a `description`, executable `examples`, and descriptions for its props. Definitions using `validate()` must also provide `constraints` explaining the custom rules. Optional `notes` describe behavior that authors should know. Catalog generation validates examples through the renderer before writing the output.

After editing and formatting definitions, run:

```sh
npm run elements:sync
npm run elements:check
```

To target a standalone content checkout:

```sh
npm run elements:sync -- --content /path/to/quartz-content
npm run elements:check -- --content /path/to/quartz-content
```

The check is read-only and exits unsuccessfully if either catalog is missing or stale. CI runs it for pull requests and before the main deployment build. Generation writes local files; it does not commit or push them. When committing a component change, commit the generated catalogs in the content repository first, then update the submodule pointer in Quartz alongside the renderer change.

Fingerprints cover element source files and the Markdown element transformer. They identify source snapshots, not deployment state. The committed catalog enables offline discovery in the standalone content repo; custom validator execution still requires the Quartz renderer. Coordinate new component usage with the renderer release before publishing. Future cross-repository PR automation can call the same sync command.

For creating or extending an element in this repo, use `$create-component`, defined at `.agents/skills/create-component/SKILL.md`. It covers the component contract, implementation, authoring metadata, tests, and catalog refresh.
