import type { ElementRegistry } from "./types"

export const embedElements: ElementRegistry = {
  Embed: {
    description:
      "Embed a website in a full-width, borderless iframe without extra controls or chrome.",
    examples: [
      '<Embed url="https://example.com" />',
      '<Embed url="https://example.com/view?a=1&amp;b=2" title="Interactive project" height="720" />',
    ],
    props: {
      url: { type: "string", required: true, description: "Absolute HTTP or HTTPS URL to embed." },
      title: {
        type: "string",
        description: "Accessible frame title; defaults to the embedded site's hostname.",
      },
      height: {
        type: "number",
        default: 600,
        min: 1,
        integer: true,
        description: "Frame height in pixels. Width always fills the available content area.",
      },
    },
    constraints: [
      "url must be an absolute HTTP or HTTPS URL without embedded credentials.",
      "title, when provided, must contain non-whitespace text.",
    ],
    notes: [
      "Place in a standalone block with blank lines around it. Frames load lazily and support fullscreen.",
      "The destination must permit iframe embedding. Its own layout, background, and theme are controlled by that site.",
      "Height is explicit: cross-origin pages cannot automatically resize to their contents without cooperation from the embedded site. Longer pages scroll inside the frame.",
      "Embeds load external content directly, without a sandbox or permission grants beyond fullscreen; use trusted destinations. HTTPS hosts may block HTTP embeds as mixed content.",
    ],
    validate: ({ url, title }) => {
      let parsed: URL
      try {
        parsed = new URL(String(url))
      } catch {
        throw new Error("url must be an absolute HTTP or HTTPS URL without embedded credentials")
      }
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error("url must be an absolute HTTP or HTTPS URL without embedded credentials")
      }
      if (title !== undefined && !String(title).trim()) {
        throw new Error("title must contain non-whitespace text")
      }
    },
    render: ({ url, title, height }) => (
      <iframe
        class="md-embed"
        src={String(url)}
        title={title === undefined ? new URL(String(url)).hostname : String(title)}
        width="100%"
        height={Number(height)}
        loading="lazy"
        allowFullScreen
      />
    ),
    css: `
      iframe.md-embed {
        display: block;
        width: 100%;
        max-width: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
      }
    `,
  },
}
