import test from "node:test"
import assert from "node:assert/strict"
import { elements } from "./index"
import { createCatalog, catalogMarkdown } from "./catalog"
import type { ElementRegistry } from "./types"

const sources = { "quartz/elements/example.tsx": "renderer source" }

test("catalog exposes all elements, nesting, prop constraints, examples and custom validation", () => {
  const catalog = createCatalog(elements, sources)
  assert.deepEqual(
    catalog.elements.map((element) => element.name),
    Object.keys(elements).sort(),
  )
  const map = catalog.elements.find((element) => element.name === "Map")!
  assert.equal(map.content, "data")
  assert.deepEqual(map.childElements, ["Point"])
  assert.equal(map.props.zoom.integer, true)
  assert.equal(map.props.zoom.max, 19)
  assert.match(map.constraints.join(" "), /latitude.*longitude/)
  const point = catalog.elements.find((element) => element.name === "Point")!
  assert.equal(point.dataOnly, true)
  assert.deepEqual(point.parents, ["Map"])
  assert.ok(point.examples.every((example) => example.startsWith("<Map")))
  const markdown = catalogMarkdown(catalog)
  assert.ok(markdown.includes(catalog.source.fingerprint))
  assert.ok(markdown.includes(map.examples[0]))
  assert.doesNotMatch(JSON.stringify(catalog), /\.md-map__viewport|function\s*\(/)
})

test("fingerprints are deterministic and track implementation and authoring-contract changes", () => {
  const first = createCatalog(elements, { ...sources, "a.ts": "a" })
  const reordered = createCatalog(elements, { "a.ts": "a", ...sources })
  assert.equal(first.source.fingerprint, reordered.source.fingerprint)
  const changedSource = createCatalog(elements, { ...sources, "a.ts": "b" })
  assert.notEqual(first.source.fingerprint, changedSource.source.fingerprint)
  const changedMetadata = createCatalog(
    { ...elements, Badge: { ...elements.Badge, description: "Changed" } },
    { ...sources, "a.ts": "a" },
  )
  assert.notEqual(first.source.fingerprint, changedMetadata.source.fingerprint)
})

test("generator rejects missing authoring metadata, undocumented validators and broken examples", () => {
  const example: ElementRegistry = {
    Example: {
      description: "Example.",
      examples: ['<Example text="Hello" />'],
      props: { text: { type: "string", required: true, description: "Text." } },
      render: ({ text }) => <span>{String(text)}</span>,
    },
  }
  const definition = example.Example
  assert.throws(
    () => createCatalog({ Example: { ...definition, description: undefined } }, sources),
    /description and examples/,
  )
  assert.throws(
    () =>
      createCatalog({ Example: { ...definition, props: { text: { type: "string" } } } }, sources),
    /missing prop description/,
  )
  assert.throws(
    () => createCatalog({ Example: { ...definition, validate: () => {} } }, sources),
    /constraints/,
  )
  assert.throws(
    () => createCatalog({ Example: { ...definition, examples: ["<Example />"] } }, sources),
    /Missing required prop/,
  )
  assert.throws(
    () => createCatalog({ Example: { ...definition, childElements: ["Missing"] } }, sources),
    /unknown related element/,
  )
})
