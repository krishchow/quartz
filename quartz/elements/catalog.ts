import { createHash } from "node:crypto"
import type { ElementRegistry } from "./types"
import { parseElement } from "./parse"
import { renderElementHtml } from "./render"

export const syntax = {
  format: "XML",
  rules: [
    "Capitalized tags refer to registered elements; ordinary lowercase HTML remains available.",
    "Use quoted attributes, including numbers and booleans. JavaScript expressions, spreads, callbacks, and brace props are unsupported.",
    "Escape ampersands and angle brackets with XML entities, and quotes with &quot; or &apos; when needed. JSON props are JSON inside a quoted attribute.",
    "Self-closing and paired tags are supported. A component's content mode determines which children it accepts.",
    "Place block elements on their own lines with blank lines around them. Use inline components inside paragraphs only when their output is inline markup.",
    "Code fences, inline code, escaped tags, and HTML comments do not invoke components. CDATA passes literal child text without invoking nested components.",
    "Definitions render at build time. Hooks, event handlers, and browser hydration are unsupported.",
    "Markdown content mode supports standard Markdown and GFM; Obsidian-specific syntax within children is not supported.",
    "Use only elements listed in this catalog. New names require implementation in the Quartz renderer before use in posts.",
  ],
  contentModes: {
    none: "Props only; non-whitespace children are rejected.",
    text: "XML-decoded text preserving whitespace; nested markup is rejected.",
    html: "Well-formed XML markup and nested registered elements rendered as children.",
    markdown: "Standard Markdown and GFM, with nested registered elements resolved first.",
    data: "Validated child elements consumed by the parent as structured data instead of independent markup.",
  },
}

export function createCatalog(registry: ElementRegistry, sources: Record<string, string>) {
  const definitions = Object.entries(registry)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, element]) => {
      if (!element.description?.trim() || !element.examples?.length)
        throw new Error(`${name}: catalog metadata needs a description and examples`)
      if (element.validate && !element.constraints?.length)
        throw new Error(`${name}: document custom validate() checks in constraints`)
      for (const relation of [...(element.childElements ?? []), ...(element.parents ?? [])]) {
        if (!Object.hasOwn(registry, relation))
          throw new Error(`${name}: unknown related element ${relation}`)
      }
      for (const [prop, schema] of Object.entries(element.props)) {
        if (!schema.description?.trim())
          throw new Error(`${name}.${prop}: missing prop description`)
      }
      // Examples for data-only elements include the parent, so they can be validated and rendered.
      for (const example of element.examples) {
        const parsed = parseElement(example)
        if (example.slice(parsed.length).trim())
          throw new Error(`${name}: example must contain one root element`)
        renderElementHtml(parsed.node, registry)
      }
      return {
        name,
        description: element.description,
        content: element.content ?? "none",
        dataOnly: element.dataOnly ?? false,
        childElements: element.childElements ?? null,
        parents: element.parents ?? null,
        props: Object.fromEntries(
          Object.entries(element.props).sort(([a], [b]) => a.localeCompare(b)),
        ),
        constraints: element.constraints ?? [],
        notes: element.notes ?? [],
        examples: element.examples,
      }
    })
  const sourceHashes = Object.fromEntries(
    Object.entries(sources)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, source]) => [path, createHash("sha256").update(source).digest("hex")]),
  )
  const contract = { schemaVersion: 1, syntax, elements: definitions }
  const fingerprint =
    "sha256:" +
    createHash("sha256").update(JSON.stringify({ contract, sourceHashes })).digest("hex")
  return {
    ...contract,
    source: {
      repository: "https://github.com/krishchow/quartz",
      branch: "v4",
      fingerprint,
      files: sourceHashes,
    },
  }
}

export type ElementCatalog = ReturnType<typeof createCatalog>

const cell = (value: string) => value.replaceAll("|", "&#124;").replaceAll("\n", " ")

export function catalogMarkdown(catalog: ElementCatalog) {
  const lines = [
    "# Available Markdown elements",
    "",
    "Generated from the Quartz element registry. Do not edit these generated files; update the definitions in Quartz and regenerate the catalog.",
    "",
    `Source: ${catalog.source.repository} (branch \`${catalog.source.branch}\`).`,
    `Fingerprint: \`${catalog.source.fingerprint}\`.`,
    "",
    "This is a checked-in snapshot of the renderer contract, usable in a standalone quartz-content checkout without Quartz or network access. It does not assert that a particular version has been deployed. Coordinate new component usage with the renderer change before publishing.",
    "",
    "## Syntax",
    "",
    ...catalog.syntax.rules.map((rule) => `- ${rule}`),
    "",
    "## Elements",
  ]
  for (const element of catalog.elements) {
    lines.push(
      "",
      `### ${element.name}`,
      "",
      element.description,
      "",
      `Content mode: \`${element.content}\`. ${catalog.syntax.contentModes[element.content]}`,
    )
    if (element.dataOnly)
      lines.push(
        "",
        "Data-only element: its parent consumes its props; it does not render standalone markup.",
      )
    if (element.parents)
      lines.push("", `Allowed parents: ${element.parents.map((name) => `\`${name}\``).join(", ")}.`)
    if (element.childElements)
      lines.push(
        "",
        `Allowed direct child elements: ${element.childElements.map((name) => `\`${name}\``).join(", ")}.`,
      )
    if (Object.keys(element.props).length) {
      lines.push(
        "",
        "| Prop | Type | Required | Default | Constraints | Description |",
        "| --- | --- | --- | --- | --- | --- |",
      )
      for (const [name, prop] of Object.entries(element.props)) {
        const constraints = [
          prop.min !== undefined ? `min ${prop.min}` : "",
          prop.max !== undefined ? `max ${prop.max}` : "",
          prop.integer ? "integer" : "",
        ]
          .filter(Boolean)
          .join(", ")
        lines.push(
          `| ${name} | ${prop.type} | ${prop.required ? "yes" : "no"} | ${prop.default === undefined ? "—" : cell(JSON.stringify(prop.default))} | ${constraints || "—"} | ${cell(prop.description!)} |`,
        )
      }
    }
    for (const note of [...element.constraints, ...element.notes]) lines.push("", note)
    for (const example of element.examples) lines.push("", "```xml", example, "```")
  }
  return lines.join("\n") + "\n"
}
