import { SaxesParser } from "saxes"
import type { ElementProps, ElementRegistry } from "./types"

export interface ElementNode {
  name: string
  attributes: Record<string, string>
  children: Array<ElementNode | string>
  offset: number
}

export class ElementError extends Error {
  constructor(
    message: string,
    public offset: number,
  ) {
    super(message)
  }
}

/** Parse one complete XML element, preserving case and stopping before surrounding Markdown. */
export function parseElement(source: string) {
  const parser = new SaxesParser({ fragment: true, xmlns: false })
  const stack: ElementNode[] = []
  let root: ElementNode | undefined
  let complete = false
  parser.on("error", (error) => {
    throw new ElementError(`Invalid element XML: ${error.message}`, parser.position - 1)
  })
  parser.on("doctype", () => {
    throw new ElementError("DOCTYPE is not supported in Markdown elements", parser.position - 1)
  })
  parser.on("processinginstruction", () => {
    throw new ElementError("Processing instructions are not supported", parser.position - 1)
  })
  parser.on("opentag", (tag) => {
    const node: ElementNode = {
      name: tag.name,
      attributes: tag.attributes,
      children: [],
      offset: source.lastIndexOf("<", parser.position - 1),
    }
    if (stack.length) stack[stack.length - 1].children.push(node)
    else root = node
    stack.push(node)
  })
  const text = (value: string) => {
    if (stack.length) stack[stack.length - 1].children.push(value)
  }
  parser.on("text", text)
  parser.on("cdata", text)
  parser.on("closetag", () => {
    stack.pop()
    if (stack.length === 0) complete = true
  })
  // Streaming lets XML determine the boundary, even with quoted '>', CDATA, and nested tags.
  let length = 0
  while (length < source.length && !complete) {
    const codepoint = source.codePointAt(length)!
    const character = String.fromCodePoint(codepoint)
    parser.write(character)
    length += character.length
  }
  if (!complete || !root) {
    parser.close()
    throw new ElementError("Unclosed element", length)
  }
  return { node: root, length }
}

/** Shared by rendering and future linting. XML decoding happens before prop validation. */
export function validateProps(node: ElementNode, registry: ElementRegistry) {
  const { name, attributes } = node
  if (!Object.hasOwn(registry, name))
    throw new ElementError(`Unknown element <${name}>`, node.offset)
  const definition = registry[name]
  const props: ElementProps = Object.create(null)
  for (const key of Object.keys(attributes)) {
    if (!Object.hasOwn(definition.props, key)) {
      throw new ElementError(`Unknown prop "${key}" on <${name}>`, node.offset)
    }
  }
  for (const [key, schema] of Object.entries(definition.props)) {
    const raw = attributes[key]
    if (raw === undefined) {
      if (schema.default !== undefined) props[key] = structuredClone(schema.default)
      else if (schema.required)
        throw new ElementError(`Missing required prop "${key}" on <${name}>`, node.offset)
      continue
    }
    const invalid = () =>
      new ElementError(`Prop "${key}" on <${name}> must be ${schema.type}`, node.offset)
    switch (schema.type) {
      case "string":
        props[key] = raw
        break
      case "boolean":
        if (raw !== "true" && raw !== "false") throw invalid()
        props[key] = raw === "true"
        break
      case "number":
        if (raw.trim() === "" || !Number.isFinite(Number(raw))) throw invalid()
        const value = Number(raw)
        if (schema.min !== undefined && value < schema.min)
          throw new ElementError(
            `Prop "${key}" on <${name}> must be at least ${schema.min}`,
            node.offset,
          )
        if (schema.max !== undefined && value > schema.max)
          throw new ElementError(
            `Prop "${key}" on <${name}> must be at most ${schema.max}`,
            node.offset,
          )
        if (schema.integer && !Number.isInteger(value))
          throw new ElementError(`Prop "${key}" on <${name}> must be an integer`, node.offset)
        props[key] = value
        break
      case "json":
        try {
          props[key] = JSON.parse(raw)
        } catch {
          throw invalid()
        }
    }
  }
  try {
    definition.validate?.(props)
  } catch (error) {
    throw new ElementError((error as Error).message, node.offset)
  }
  return { props, definition }
}
