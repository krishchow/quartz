import test from "node:test"
import assert from "node:assert/strict"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import rehypeRaw from "rehype-raw"
import { toHtml } from "hast-util-to-html"
import { VFile } from "vfile"
import { remarkElements, MarkdownElements } from "../plugins/transformers/elements"
import { elements } from "./index"
import { parseElement, validateProps } from "./parse"
import type { ElementRegistry } from "./types"
import type { Root } from "hast"

const registry: ElementRegistry = {
  ...elements,
  Panel: { props: {}, content: "html", render: (_, children) => <aside>{children}</aside> },
  Prose: { props: {}, content: "markdown", render: (_, children) => <section>{children}</section> },
  Literal: { props: {}, content: "text", render: (_, children) => <pre>{children}</pre> },
}

async function compile(value: string, definitions = registry) {
  const file = new VFile({ path: "post.md", value })
  const processor = unified()
    .use(remarkParse)
    .use(remarkElements, definitions)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
  return toHtml((await processor.run(processor.parse(file), file)) as Root)
}

test("renders standalone, multiline, inline and adjacent elements", async () => {
  assert.match(await compile('<Badge\n text="Hello"\n/>'), /class="md-badge"[^>]*>Hello<\/span>/)
  const html = await compile('Before <Badge text="one" /> <Badge text="two" /> after.')
  assert.match(html, /Before <span/)
  assert.match(html, />one<\/span> <span/)
  assert.match(html, />two<\/span> after/)
})

test("keeps code examples, escaped tags and ordinary HTML intact", async () => {
  assert.match(await compile("`<Unknown />`"), /<code>&#x3C;Unknown \/><\/code>/)
  assert.match(await compile("```html\n<Unknown />\n```"), /language-html/)
  assert.match(await compile("    <Unknown />"), /<code>/)
  assert.match(await compile('<div class="box">Hello</div>'), /<div class="box">Hello<\/div>/)
  assert.match(await compile("\\<Unknown />"), /&#x3C;Unknown/)
  assert.match(await compile("&lt;Unknown />"), /&#x3C;Unknown/)
  assert.match(await compile("<!-- <Unknown /> -->"), /<!-- <Unknown \/> -->/)
  assert.match(await compile('<div title="<Unknown />">Hello</div>'), /title="/)
  assert.match(await compile("<code><Unknown /></code>"), /<unknown>/)
})

test("XML handles entities, quote delimiters, whitespace, newlines and Unicode", async () => {
  const parsed = parseElement(
    `<Badge\r\n\ttext = 'A &amp; B &quot;quoted&quot; &#x1F680; &lt;tag&gt;'\r\n /> trailing`,
  )
  assert.equal(parsed.node.attributes.text, 'A & B "quoted" 🚀 <tag>')
  assert.equal(
    `<Badge\r\n\ttext = 'A &amp; B &quot;quoted&quot; &#x1F680; &lt;tag&gt;'\r\n /> trailing`.slice(
      parsed.length,
    ),
    " trailing",
  )
  const html = await compile(`<Badge text='&lt;script&gt;alert(1)&lt;/script&gt;' />`)
  assert.match(html, /&#x3C;script>/)
  assert.doesNotMatch(html, /<script>/)
  assert.equal(parseElement('<Badge text="one\ntwo" />').node.attributes.text, "one two")
  assert.equal(parseElement('<Badge text="one&#10;two" />').node.attributes.text, "one\ntwo")
})

test("supports paired tags, nested elements, native XML markup, and comments", async () => {
  const html = await compile(
    `<Panel>\n<strong>Title</strong>\n<Panel><Badge text="Nested" /></Panel>\n<!-- ignored -->\n</Panel>\n\nAfter`,
  )
  assert.match(
    html,
    /<aside>\n<strong>Title<\/strong>\n<aside><span class="md-badge">Nested<\/span><\/aside>/,
  )
  assert.match(html, /<p>After<\/p>/)
  assert.match(await compile('<Badge text="Paired"></Badge>'), />Paired<\/span>/)
})

test("text mode preserves whitespace and supports literal markup through CDATA", async () => {
  assert.match(
    await compile("<Literal><![CDATA[  <Unknown />\n& raw\n]]></Literal>"),
    /<pre>  &#x3C;Unknown \/>\n&#x26; raw\n<\/pre>/,
  )
  await assert.rejects(compile('<Literal><Badge text="x" /></Literal>'), /text only/)
  await assert.rejects(compile('<Badge text="x">children</Badge>'), /does not accept children/)
})

test("Markdown mode supports GFM and nested registered elements", async () => {
  const html = await compile(
    '<Prose>\n\n## Heading\n\n**Strong** and ~~gone~~.\n\n- One\n- Two\n\n<Badge text="Status" />\n\n</Prose>',
  )
  assert.match(html, /<h2>Heading<\/h2>/)
  assert.match(html, /<strong>Strong<\/strong>/)
  assert.match(html, /<del>gone<\/del>/)
  assert.match(html, /<li>Two<\/li>/)
  assert.match(html, /class="md-badge">Status/)
})

test("reports source filenames and exact locations, including nested errors", async () => {
  for (const [value, message] of [
    ["<Unknown />", /Unknown element/],
    ["<Badge />", /Missing required prop/],
    ['<Badge typo="x" />', /Unknown prop/],
    ['<Badge text="x" text="y" />', /duplicate attribute/],
    ["<Badge text={value} />", /Invalid element XML/],
    ['<Badge text="x">', /unclosed tag/],
    ['<Badge text="unterminated />', /unexpected end/],
    ['<Badge text="A & B" />', /Invalid element XML/],
    ['<Panel><Badge text="x" /></Wrong>', /Invalid element XML/],
    ['<Badge text="&unknown;" />', /undefined entity/],
    ["</Badge>", /Invalid element XML/],
  ] as const) {
    await assert.rejects(compile("\n\n" + value), (error: any) => {
      assert.match(error.message, message)
      assert.equal(error.line, 3)
      assert.ok(error.column >= 1)
      assert.equal(error.file, "post.md")
      return true
    })
  }
  await assert.rejects(compile("<Panel>\n  <Unknown />\n</Panel>"), (error: any) => {
    assert.equal(error.line, 2)
    assert.equal(error.column, 3)
    return true
  })
})

test("registry validates typed props and clones defaults", () => {
  const definitions: ElementRegistry = {
    Example: {
      props: {
        title: { type: "string", default: "Default" },
        count: { type: "number", required: true },
        active: { type: "boolean" },
        data: { type: "json", default: [] },
      },
      render: () => <aside>Example</aside>,
      css: ".example { color: red; }",
    },
  }
  const parsed = parseElement(`<Example count="4" active="true" data='["a", "b"]' />`)
  assert.deepEqual(
    { ...validateProps(parsed.node, definitions).props },
    { title: "Default", count: 4, active: true, data: ["a", "b"] },
  )
  for (const source of [
    '<Example count="NaN" />',
    '<Example count="" />',
    '<Example count="1" active="yes" />',
    `<Example count="1" data='oops' />`,
  ]) {
    assert.throws(() => validateProps(parseElement(source).node, definitions), /must be/)
  }
  const first = validateProps(parseElement('<Example count="1" />').node, definitions)
  ;(first.props.data as unknown[]).push("changed")
  assert.deepEqual(
    validateProps(parseElement('<Example count="1" />').node, definitions).props.data,
    [],
  )
  assert.match(MarkdownElements({ registry: definitions }).css!, /color: red/)
})

test("Map renders a static basemap, numbered points, escaped labels and attribution", async () => {
  const html = await compile(`<Map title="Places &amp; notes" center='[40.73, -73.99]' zoom="12">
    <Point lat="40.73" lng="-73.99" label="Coffee &amp; tea" />
    <Point lat="40.75" lng="-74.00" label="Bookshop" />
  </Map>`)
  assert.match(html, /class="md-map"/)
  assert.match(html, /https:\/\/tile.openstreetmap.org\/12\//)
  assert.match(html, /loading="lazy"/)
  assert.match(html, /transform="translate\(400 225\)"/)
  assert.match(html, /viewBox="0 0 800 450"/)
  assert.match(html, /<li>Coffee &#x26; tea<\/li>/)
  assert.match(html, /<li>Bookshop<\/li>/)
  assert.match(html, /© OpenStreetMap contributors/)
  assert.doesNotMatch(html, /<script|<point|<Point/)
  assert.match(await compile("<Map />"), /class="md-map"/)
  assert.match(await compile('<Map><Point lat="0" lng="0" /></Map>'), /<li>Point 1<\/li>/)
})

test("Map validates coordinates, viewport props and its child schema", async () => {
  for (const [source, reason] of [
    ['<Point lat="1" lng="2" />', /must be a child of <Map>/],
    ['<Map><Point lat="91" lng="0" /></Map>', /at most 90/],
    ['<Map><Point lat="0" lng="-181" /></Map>', /at least -180/],
    ['<Map><Point lat="0" /></Map>', /Missing required prop "lng"/],
    ['<Map><Badge text="bad" /></Map>', /only accepts <Point>/],
    ["<Map>unexpected text</Map>", /not text/],
    ['<Map><Point lat="0" lng="0"><Badge text="bad" /></Point></Map>', /does not accept children/],
    ["<Map center='[\"0\", 1]' />", /center must be/],
    ["<Map center='[0, 181]' />", /center must be/],
    ['<Map center="null" />', /center must be/],
    ['<Map zoom="1.5" />', /must be an integer/],
    ['<Map zoom="20" />', /at most 19/],
    ['<Map width="0" />', /at least 256/],
    ['<Map height="2000" />', /at most 1200/],
  ] as const) {
    await assert.rejects(compile(source), reason)
  }
  await assert.rejects(compile('<Map>\n  <Point lat="91" lng="0" />\n</Map>'), (error: any) => {
    assert.equal(error.line, 2)
    assert.equal(error.column, 3)
    return true
  })
})

test("data children are generic and can contain nested validated data", async () => {
  const definitions: ElementRegistry = {
    Collection: {
      props: {},
      content: "data",
      childElements: ["Group"],
      render: (_, __, { elements }) => (
        <div>
          {elements[0].elements.map((item) => (
            <span>{String(item.props.value)}</span>
          ))}
        </div>
      ),
    },
    Group: { props: {}, content: "data", childElements: ["Item"], dataOnly: true },
    Item: { props: { value: { type: "string", required: true } }, dataOnly: true },
  }
  assert.equal(
    await compile(
      '<Collection><Group><Item value="one" /><Item value="two" /></Group></Collection>',
      definitions,
    ),
    "<div><span>one</span><span>two</span></div>",
  )
  await assert.rejects(
    compile('<Item value="orphan" />', definitions),
    /must be consumed by a parent/,
  )
})

test("SlotStack renders linked JSON and rich alternatives through one list item structure", async () => {
  const html = await compile(
    `<SlotStack bullets="true">The <SlotStack.Slot href="/starting" items='["ending", {"text":"middle","href":"/middle"}]'>starting<SlotStack.Item href="/body" className="custom"><em>body</em></SlotStack.Item></SlotStack.Slot> of a phrase</SlotStack>`,
  )
  assert.match(html, /<div class="md-slot-stack md-slot-stack-bullets">The /)
  assert.match(html, /role="list"/)
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 4)
  assert.match(
    html,
    /<a href="\/starting">starting<\/a><\/span><span role="listitem" class="md-slot-stack-item">ending/,
  )
  assert.match(html, /<a href="\/middle">middle<\/a>/)
  assert.match(html, /class="md-slot-stack-item custom"><a href="\/body"><em>body<\/em><\/a>/)
  assert.match(html, /<\/span> of a phrase<\/div>/)
  assert.doesNotMatch(html, /<p>/)
})

test("SlotStack keeps multiple slots independent, supports empty alternatives, and defaults bullets off", async () => {
  const html = await compile(
    `<SlotStack><SlotStack.Slot items='["second"]'>first</SlotStack.Slot> and <SlotStack.Slot>only</SlotStack.Slot></SlotStack>`,
  )
  assert.equal((html.match(/role="list"/g) ?? []).length, 2)
  assert.equal((html.match(/role="listitem"/g) ?? []).length, 3)
  assert.doesNotMatch(html, /md-slot-stack-bullets/)
  assert.match(html, />first<\/span><span[^>]*>second<\/span><\/span> and /)
})

test("SlotStack validates alternatives, nesting, and links", async () => {
  for (const items of [
    "{}",
    "[1]",
    "[null]",
    '[{"text":"x","style":"red"}]',
    '[{"text":"x","href":2}]',
  ]) {
    await assert.rejects(
      compile(`<SlotStack><SlotStack.Slot items='${items}'>first</SlotStack.Slot></SlotStack>`),
      /items must be an array/,
    )
  }
  await assert.rejects(
    compile("<SlotStack.Slot>first</SlotStack.Slot>"),
    /must be a child of <SlotStack>/,
  )
  await assert.rejects(
    compile("<SlotStack><SlotStack.Item>x</SlotStack.Item></SlotStack>"),
    /must be a child of <SlotStack.Slot>/,
  )
  await assert.rejects(
    compile('<SlotStack><SlotStack.Slot href="javascript:alert(1)">x</SlotStack.Slot></SlotStack>'),
    /not an executable URL/,
  )
  await assert.rejects(
    compile(
      `<SlotStack><SlotStack.Slot items='[{"text":"x","href":"data:text/html,test"}]'>x</SlotStack.Slot></SlotStack>`,
    ),
    /not an executable URL/,
  )
  await assert.rejects(
    compile(
      '<SlotStack><SlotStack.Slot>x<SlotStack.Item href="java&#9;script:alert(1)">bad</SlotStack.Item></SlotStack.Slot></SlotStack>',
    ),
    /not an executable URL/,
  )
  const html = await compile(
    `<SlotStack><SlotStack.Slot items='["&lt;script&gt;"]'>A &amp; B</SlotStack.Slot></SlotStack>`,
  )
  assert.match(html, /A &#x26; B/)
  assert.doesNotMatch(html, /<script>/)
})
