import { createElement, Fragment, type ComponentChildren } from "preact"
import { render } from "preact-render-to-string"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkRehype from "remark-rehype"
import rehypeRaw from "rehype-raw"
import { toJsxRuntime, type Jsx } from "hast-util-to-jsx-runtime"
import { jsx, jsxs } from "preact/jsx-runtime"
import type { Root } from "hast"
import { ElementError, validateProps, type ElementNode } from "./parse"
import type { ElementData, ElementRegistry } from "./types"

const markdown = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)

function html(children: ComponentChildren): string {
  return render(createElement(Fragment, null, children))
}

function validateParent(node: ElementNode, registry: ElementRegistry, parent?: string) {
  const allowed = registry[node.name].parents
  if (allowed && (!parent || !allowed.includes(parent))) {
    throw new ElementError(
      `<${node.name}> must be a child of ${allowed.map((name) => `<${name}>`).join(" or ")}`,
      node.offset,
    )
  }
}

function dataChildren(node: ElementNode, registry: ElementRegistry): ElementData[] {
  const definition = registry[node.name]
  const children: ElementData[] = []
  for (const child of node.children) {
    if (typeof child === "string") {
      if (child.trim())
        throw new ElementError(`<${node.name}> accepts child elements, not text`, node.offset)
      continue
    }
    const { props, definition: childDefinition } = validateProps(child, registry)
    validateParent(child, registry, node.name)
    if (definition.childElements && !definition.childElements.includes(child.name)) {
      throw new ElementError(
        `<${node.name}> only accepts ${definition.childElements.map((name) => `<${name}>`).join(", ")}`,
        child.offset,
      )
    }
    if (
      childDefinition.content &&
      childDefinition.content !== "none" &&
      childDefinition.content !== "data"
    ) {
      throw new ElementError(
        `<${child.name}> must use data or none content inside a data element`,
        child.offset,
      )
    }
    if (
      childDefinition.content !== "data" &&
      child.children.some((value) => typeof value !== "string" || value.trim())
    ) {
      throw new ElementError(`<${child.name}> does not accept children`, child.offset)
    }
    children.push({
      name: child.name,
      props,
      elements: childDefinition.content === "data" ? dataChildren(child, registry) : [],
    })
  }
  return children
}

export function renderElement(
  node: ElementNode,
  registry: ElementRegistry,
  parent?: string,
): ComponentChildren {
  const { props, definition } = validateProps(node, registry)
  validateParent(node, registry, parent)
  if (definition.dataOnly)
    throw new ElementError(
      `<${node.name}> is data and must be consumed by a parent element`,
      node.offset,
    )
  const mode = definition.content ?? "none"
  let children: ComponentChildren = null
  let elements: ElementData[] = []
  if (mode === "data") {
    elements = dataChildren(node, registry)
  } else if (mode === "none") {
    if (node.children.some((child) => typeof child !== "string" || child.trim())) {
      throw new ElementError(`<${node.name}> does not accept children`, node.offset)
    }
  } else if (mode === "text") {
    if (node.children.some((child) => typeof child !== "string")) {
      throw new ElementError(
        `<${node.name}> accepts text only; escape markup or use CDATA`,
        node.offset,
      )
    }
    children = node.children.join("")
  } else {
    const renderChild = (child: ElementNode | string): ComponentChildren => {
      if (typeof child === "string") return child
      if (/^[A-Z]/.test(child.name)) return renderElement(child, registry, node.name)
      return createElement(child.name, child.attributes, ...child.children.map(renderChild))
    }
    children = node.children.map(renderChild)
    if (mode === "markdown") {
      // Keep XML-decoded text as Markdown while serializing nested elements as HTML.
      const source = node.children
        .map((child) => (typeof child === "string" ? child : html(renderChild(child))))
        .join("")
      const tree = markdown.runSync(markdown.parse(source)) as Root
      children = toJsxRuntime(tree, {
        Fragment,
        jsx: jsx as Jsx,
        jsxs: jsxs as Jsx,
        elementAttributeNameCase: "html",
      })
    }
  }
  return definition.render(props, children, { elements })
}

export function renderElementHtml(node: ElementNode, registry: ElementRegistry) {
  return html(renderElement(node, registry))
}
