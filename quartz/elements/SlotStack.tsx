import { isValidElement, toChildArray, type ComponentChildren } from "preact"
import type { ElementProps, ElementRegistry } from "./types"

type Item = string | { text: string; href?: string }

function validateHref(href: unknown) {
  if (
    typeof href === "string" &&
    /^(?:[\s\u0000-\u0020]*)(?:javascript|data|vbscript):/i.test(href.replace(/[\t\n\r]/g, ""))
  ) {
    throw new Error("href must be a page URL, not an executable URL")
  }
}

function item(props: ElementProps, children: ComponentChildren) {
  const content = props.href ? <a href={String(props.href)}>{children}</a> : children
  return (
    <span
      role="listitem"
      class={`md-slot-stack-item${props.className ? ` ${props.className}` : ""}`}
    >
      {content}
    </span>
  )
}

const example = `<SlotStack bullets="true">The <SlotStack.Slot href="/starting" items='["ending", {"text":"middle","href":"/middle"}]'>starting</SlotStack.Slot> of a phrase</SlotStack>`
const customExample = `<SlotStack>The <SlotStack.Slot>starting<SlotStack.Item href="/ending">ending</SlotStack.Item><SlotStack.Item className="italic"><em>middle</em></SlotStack.Item></SlotStack.Slot> of a phrase</SlotStack>`

export const slotStackElements: ElementRegistry = {
  SlotStack: {
    description:
      "A phrase with interchangeable words stacked beneath their positions, all visible at once.",
    examples: [example, customExample],
    content: "html",
    props: {
      bullets: {
        type: "boolean",
        default: false,
        description: "Show a bullet on every slot item, including the inline word.",
      },
    },
    notes: [
      "Place in a standalone block with blank lines around it. Use literal spaces between phrase words, not JSX expressions.",
      "Slots align independently to the first word baseline. All alternatives are visible; there is no selection or browser interaction.",
      "Use XML markup and className on custom items for rich content. React callbacks, style objects, and component overrides are unsupported.",
    ],
    render: ({ bullets }, children) => (
      <div class={`md-slot-stack${bullets ? " md-slot-stack-bullets" : ""}`}>{children}</div>
    ),
    css: `
      .md-slot-stack { margin: 1rem 0; line-height: 1.6; }
      .md-slot-stack .md-slot-stack-slot {
        display: inline-grid;
        grid-template-columns: max-content;
        vertical-align: baseline;
        align-items: baseline;
        max-width: 100%;
      }
      .md-slot-stack .md-slot-stack-item { display: block; grid-column: 1; }
      .md-slot-stack-bullets .md-slot-stack-item::before {
        content: "•";
        display: inline-block;
        width: 1em;
        color: var(--gray);
      }
    `,
  },
  "SlotStack.Slot": {
    description:
      "A word position whose first word stays on the phrase line and whose alternatives stack below it.",
    examples: [example, customExample],
    parents: ["SlotStack"],
    content: "html",
    props: {
      href: { type: "string", description: "Optional URL for the inline word." },
      items: {
        type: "json",
        description: "Alternatives as strings or objects containing only text and optional href.",
      },
    },
    constraints: [
      "items must be an array of strings or objects with only a string text and optional string href.",
      "Links must not use javascript:, data:, or vbscript: URLs.",
    ],
    notes: [
      "Children other than direct SlotStack.Item elements form the inline word. JSON alternatives appear before custom Item alternatives.",
    ],
    validate: ({ href, items }) => {
      validateHref(href)
      if (items === undefined) return
      if (
        !Array.isArray(items) ||
        items.some(
          (value) =>
            typeof value !== "string" &&
            (!value ||
              typeof value !== "object" ||
              Array.isArray(value) ||
              typeof value.text !== "string" ||
              (value.href !== undefined && typeof value.href !== "string") ||
              Object.keys(value).some((key) => key !== "text" && key !== "href")),
        )
      ) {
        throw new Error(
          "items must be an array of strings or objects containing only string text and optional string href",
        )
      }
      for (const value of items) if (typeof value !== "string") validateHref(value.href)
    },
    render: ({ href, items }, children) => {
      const first: ComponentChildren[] = []
      const alternatives: ComponentChildren[] = []
      for (const child of toChildArray(children)) {
        if (
          isValidElement(child) &&
          "role" in child.props &&
          "class" in child.props &&
          child.props.role === "listitem" &&
          String(child.props.class).split(" ").includes("md-slot-stack-item")
        )
          alternatives.push(child)
        else first.push(child)
      }
      return (
        <span class="md-slot-stack-slot" role="list">
          {item({ href: href ?? null }, first)}
          {((items ?? []) as Item[]).map((value) =>
            typeof value === "string"
              ? item({}, value)
              : item({ href: value.href ?? null }, value.text),
          )}
          {alternatives}
        </span>
      )
    },
  },
  "SlotStack.Item": {
    description:
      "A rich alternative belonging to a SlotStack.Slot, optionally linked and styled with a CSS class.",
    examples: [customExample],
    parents: ["SlotStack.Slot"],
    content: "html",
    props: {
      href: { type: "string", description: "Optional URL for this alternative." },
      className: { type: "string", description: "Optional CSS classes on the list item." },
    },
    constraints: ["Links must not use javascript:, data:, or vbscript: URLs."],
    validate: ({ href }) => validateHref(href),
    render: item,
  },
}
