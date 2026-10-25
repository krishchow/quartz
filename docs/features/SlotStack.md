---
title: SlotStack
---

`SlotStack` displays a phrase with interchangeable words stacked beneath their positions. All words stay visible; each can link to a page. Put the container in its own Markdown block, with blank lines around it:

```xml
<SlotStack bullets="true">The <SlotStack.Slot href="/starting" items='["ending", {"text":"middle","href":"/middle"}]'>starting</SlotStack.Slot> of a phrase</SlotStack>
```

Omit `bullets` to hide bullets. When enabled, every item has a bullet, including the word on the sentence line. Each slot forms an accessible list with native links, and aligns independently using an inline CSS grid. Typography inherits from the page.

For rich alternatives, use `SlotStack.Item` within its slot:

```xml
<SlotStack>The <SlotStack.Slot href="/starting">starting<SlotStack.Item href="/ending">ending</SlotStack.Item><SlotStack.Item className="my-alternative"><em>middle</em></SlotStack.Item></SlotStack.Slot> of a phrase</SlotStack>
```

Children other than direct `SlotStack.Item` elements form the inline word. Supply the literal spaces around slots as part of the phrase. JSON `items` accepts only strings or objects containing `text` and optional `href`; use child items for markup and CSS classes. If both forms are supplied, JSON alternatives precede child items.

Multiple slots can appear in the same phrase. Their row counts and column widths are independent. Long phrases wrap between words; each slot keeps its alternatives together.

This is a static Markdown adaptation of the React API: no callbacks, `as` component overrides, JavaScript style objects, or event handlers. Use XML markup and site CSS for custom presentation. See [[Markdown elements]] for escaping and other authoring rules. Deploy the renderer before publishing content that uses these tags.
