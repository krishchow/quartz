import type { ComponentChildren } from "preact"

export interface ElementProp {
  description?: string
  type: "string" | "number" | "boolean" | "json"
  required?: boolean
  min?: number
  max?: number
  integer?: boolean
  default?: string | number | boolean | object | null
}

export type ElementProps = Record<string, string | number | boolean | object | null>

/** Validated children for components that consume data instead of rendered markup. */
export interface ElementData {
  name: string
  props: ElementProps
  elements: ElementData[]
}

interface ElementDefinition {
  /** Authoring metadata exported to the content repo. Required by the catalog generator. */
  description?: string
  examples?: string[]
  notes?: string[]
  /** Describe checks in validate() that cannot be inferred from prop schemas. */
  constraints?: string[]
  props: Record<string, ElementProp>
  content?: "none" | "text" | "html" | "markdown" | "data"
  /** Restrict direct children in data mode. */
  childElements?: string[]
  /** Restrict where an element can appear. */
  parents?: string[]
  validate?: (props: ElementProps) => void
  css?: string
}

/** Renderers run at build time. Data-only definitions are consumed by a parent. */
export type MarkdownElement = ElementDefinition &
  (
    | { dataOnly: true; render?: never }
    | {
        dataOnly?: false
        render: (
          props: ElementProps,
          children: ComponentChildren,
          context: { elements: ElementData[] },
        ) => ComponentChildren
      }
  )

export type ElementRegistry = Record<string, MarkdownElement>
