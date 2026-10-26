import type { ElementRegistry } from "./types"
import { mapElements } from "./Map"
import { slotStackElements } from "./SlotStack"
import { embedElements } from "./Embed"

/** Add static Markdown elements here. Names must start with a capital letter. */
export const elements: ElementRegistry = {
  ...embedElements,
  ...mapElements,
  ...slotStackElements,
  Badge: {
    description: "A small inline status label styled with the site's theme.",
    examples: ['<Badge text="Work in progress" />'],
    props: {
      text: { type: "string", required: true, description: "The visible badge text." },
    },
    render: ({ text }) => <span class="md-badge">{String(text)}</span>,
    css: `
      .md-badge {
        display: inline-block;
        padding: .1em .55em;
        border: 1px solid var(--lightgray);
        border-radius: .4em;
        background: var(--highlight);
        color: var(--darkgray);
        font-size: .85em;
      }
    `,
  },
}
