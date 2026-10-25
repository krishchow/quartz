import type { Root } from "mdast"
import type { Plugin } from "unified"
import { visit } from "unist-util-visit"
import type { ElementRegistry } from "../../elements/types"
import { elements } from "../../elements"
import { ElementError, parseElement } from "../../elements/parse"
import { renderElementHtml } from "../../elements/render"
import type { QuartzTransformerPlugin } from "../types"

/** Recognize element starts in Markdown nodes, leaving code, escapes, and ordinary HTML alone. */
export const remarkElements: Plugin<[ElementRegistry], Root> = function (registry) {
  const processor = this
  return (tree, file) => {
    const source = String(file.value)
    const candidates: number[] = []
    const protectedRanges: Array<[number, number]> = []
    visit(tree, (node) => {
      if ((node.type !== "html" && node.type !== "text") || !node.position) return
      const offset = node.position.start.offset!
      const value = source.slice(offset, node.position.end.offset)
      // Skip whole regular HTML tags, comments, and raw-text containers before looking for XML roots.
      const pattern =
        /<!--[\s\S]*?-->|<(script|style|pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?[a-z][a-z0-9-]*(?:[^>"']|"[^"]*"|'[^']*')*>|<\/?[A-Z][\w.-]*/g
      let match: RegExpExecArray | null
      while ((match = pattern.exec(value))) {
        const raw = /^<(script|style|pre|code)\b/.exec(match[0])
        if (raw) {
          const start = offset + match.index
          const close = new RegExp(`</${raw[1]}\\s*>`, "g")
          close.lastIndex = start + match[0].indexOf(">") + 1
          const end = close.exec(source)
          protectedRanges.push([start, end ? close.lastIndex : source.length])
        }
        if (!/^<\/?[A-Z]/.test(match[0])) continue
        if (node.type === "text" && /\\*$/.exec(value.slice(0, match.index))![0].length % 2 === 1)
          continue
        candidates.push(offset + match.index)
      }
    })
    let cursor = 0
    let output = ""
    for (const offset of candidates.sort((a, b) => a - b)) {
      if (protectedRanges.some(([start, end]) => offset >= start && offset < end)) continue
      if (offset < cursor) continue // Nested elements belong to the XML parser, not Markdown's AST.
      try {
        const parsed = parseElement(source.slice(offset))
        output += source.slice(cursor, offset) + renderElementHtml(parsed.node, registry)
        cursor = offset + parsed.length
      } catch (error) {
        const location = offset + (error instanceof ElementError ? error.offset : 0)
        const lines = source.slice(0, location).split("\n")
        const line = lines.length
        const column = lines[lines.length - 1].length + 1
        // Quartz's CLI prints Error.message, so include the location there as well as in VFile.
        file.fail(`${file.path ?? "Markdown"}:${line}:${column}: ${(error as Error).message}`, {
          line,
          column,
        })
      }
    }
    if (cursor) {
      // Reparse with this processor's syntax extensions, including frontmatter. Later transforms
      // still process the resulting HTML, links and headings through Quartz's normal pipeline.
      const result = processor.parse(output + source.slice(cursor)) as Root
      tree.children = result.children
    }
  }
}

export const MarkdownElements: QuartzTransformerPlugin<{ registry?: ElementRegistry }> = (opts) => {
  const registry = opts?.registry ?? elements
  for (const name of Object.keys(registry)) {
    if (!/^[A-Z][\w.-]*$/.test(name)) throw new Error(`Invalid Markdown element name: ${name}`)
  }
  return {
    name: "MarkdownElements",
    markdownPlugins: () => [[remarkElements, registry]],
    css: Object.values(registry)
      .map((element) => element.css ?? "")
      .join("\n"),
  }
}
