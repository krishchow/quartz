import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = fileURLToPath(new URL("../", import.meta.url))
function run(...args: string[]) {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/sync-element-catalog.ts", ...args],
    { cwd: root, encoding: "utf8" },
  )
}

test("standalone sync is deterministic, checks without rewriting, and detects missing or stale catalogs", async () => {
  const content = await mkdtemp(join(tmpdir(), "quartz-catalog-"))
  try {
    await writeFile(join(content, "index.md"), "# Content\n")
    const missing = run("--check", "--content", content)
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /stale or missing/)
    const sync = run("--content", content)
    assert.equal(sync.status, 0, sync.stderr)
    const jsonPath = join(content, ".authoring/elements.json")
    const markdownPath = join(content, ".authoring/elements.md")
    const json = await readFile(jsonPath, "utf8")
    const markdown = await readFile(markdownPath, "utf8")
    assert.ok(JSON.parse(json).elements.some((element: { name: string }) => element.name === "Map"))
    assert.equal(run("--content", content, "--check").status, 0)
    assert.equal(run("--content", content).status, 0)
    assert.equal(await readFile(jsonPath, "utf8"), json)
    assert.equal(await readFile(markdownPath, "utf8"), markdown)
    await writeFile(markdownPath, "manually edited")
    const stale = run("--content", content, "--check")
    assert.equal(stale.status, 1)
    assert.equal(await readFile(markdownPath, "utf8"), "manually edited")
    assert.equal(await readFile(jsonPath, "utf8"), json)
    assert.match(stale.stderr, /commit the generated files in quartz-content/)
  } finally {
    await rm(content, { recursive: true, force: true })
  }
})

test("catalog CLI rejects unknown or incomplete arguments", () => {
  assert.notEqual(run("--unknown").status, 0)
  assert.notEqual(run("--content").status, 0)
  assert.notEqual(run("--content", "--check").status, 0)
})
