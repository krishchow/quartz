import { readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { resolve, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { format } from "prettier"
import { elements } from "../quartz/elements"
import { createCatalog, catalogMarkdown } from "../quartz/elements/catalog"

const root = fileURLToPath(new URL("../", import.meta.url))
const args = process.argv.slice(2)
const check = args.includes("--check")
const targetIndex = args.indexOf("--content")
const valid = args.filter(
  (arg, index) =>
    arg !== "--check" &&
    !(targetIndex >= 0 && (index === targetIndex || index === targetIndex + 1)),
)
if (
  valid.length ||
  (targetIndex >= 0 && (!args[targetIndex + 1] || args[targetIndex + 1].startsWith("--")))
) {
  throw new Error("Usage: npm run elements:sync -- [--check] [--content /path/to/quartz-content]")
}
const target = resolve(root, targetIndex < 0 ? "content" : args[targetIndex + 1])
// Do not silently manufacture a replacement checkout when the submodule is missing.
await readFile(join(target, "index.md"))

async function sourcesIn(directory: string): Promise<Record<string, string>> {
  const sources: Record<string, string> = {}
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) Object.assign(sources, await sourcesIn(path))
    else if (/\.(tsx?|s?css|json)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
      sources[relative(root, path).replaceAll("\\", "/")] = await readFile(path, "utf8")
    }
  }
  return sources
}

const sources = await sourcesIn(join(root, "quartz/elements"))
for (const path of ["quartz/plugins/transformers/elements.ts"]) {
  sources[path] = await readFile(join(root, path), "utf8")
}
const catalog = createCatalog(elements, sources)
const files = {
  "elements.json": await format(JSON.stringify(catalog), { parser: "json" }),
  "elements.md": await format(catalogMarkdown(catalog), { parser: "markdown" }),
}
const stale: string[] = []
for (const [name, expected] of Object.entries(files)) {
  const path = join(target, ".authoring", name)
  if (check) {
    let actual: string | undefined
    try {
      actual = await readFile(path, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    }
    if (actual !== expected) stale.push(path)
  } else {
    await mkdir(join(target, ".authoring"), { recursive: true })
    await writeFile(path, expected)
    console.log(`Updated ${relative(root, path)}`)
  }
}
if (stale.length) {
  console.error(
    `Element catalog is stale or missing:\n${stale.map((path) => `  ${path}`).join("\n")}\nRun npm run elements:sync, then commit the generated files in quartz-content and update the submodule pointer in Quartz.`,
  )
  process.exitCode = 1
} else if (check) console.log(`Element catalog is current (${catalog.source.fingerprint}).`)
