import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, SimpleSlug, resolveRelative, simplifySlug, stripSlashes } from "../util/path"
import style from "./styles/folderIndex.scss"

interface FolderIndexOptions {
  /** Whether to show a "draft" badge next to unpublished entries */
  showDraftBadge: boolean
}

const defaultOptions: FolderIndexOptions = {
  showDraftBadge: true,
}

interface IndexEntry {
  slug: FullSlug
  title: string
  hint?: string
  draft: boolean
}

interface TreeNode {
  name: string
  entry?: IndexEntry
  children: Map<string, TreeNode>
}

function insert(root: TreeNode, parts: string[], entry: IndexEntry) {
  let node = root
  for (const part of parts) {
    if (!node.children.has(part)) {
      node.children.set(part, { name: part, children: new Map() })
    }
    node = node.children.get(part)!
  }
  node.entry = entry
}

export default ((userOpts?: Partial<FolderIndexOptions>) => {
  const opts = { ...defaultOptions, ...userOpts }

  const FolderIndex: QuartzComponent = ({ ctx, fileData, allFiles }: QuartzComponentProps) => {
    const currentSlug = fileData.slug!
    const folderSlug = stripSlashes(simplifySlug(currentSlug)) as SimpleSlug
    const prefix = folderSlug === "" ? "" : folderSlug + "/"

    const entries: IndexEntry[] = []
    for (const file of allFiles) {
      const slug = file.slug!
      const simple = stripSlashes(simplifySlug(slug))
      if (simple === folderSlug || !simple.startsWith(prefix)) continue
      entries.push({
        slug,
        title: file.frontmatter?.title ?? simple,
        hint: (file.frontmatter?.hint as string | undefined) ?? file.frontmatter?.description,
        draft: false,
      })
    }

    for (const meta of ctx.filteredMeta ?? []) {
      const simple = stripSlashes(simplifySlug(meta.slug))
      if (simple === folderSlug || !simple.startsWith(prefix)) continue
      entries.push({
        slug: meta.slug,
        title: meta.title,
        hint: meta.hint,
        draft: true,
      })
    }

    if (entries.length === 0) {
      return null
    }

    // build nested tree keyed by path relative to the current folder
    const root: TreeNode = { name: "", children: new Map() }
    for (const entry of entries) {
      const rel = stripSlashes(simplifySlug(entry.slug)).slice(prefix.length)
      insert(root, rel.split("/"), entry)
    }

    const renderNode = (node: TreeNode) => {
      const entry = node.entry
      const childNodes = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name))
      return (
        <li class={entry?.draft ? "folder-index-draft" : ""}>
          {entry ? (
            entry.draft ? (
              <span class="folder-index-title">
                {entry.title}
                {opts.showDraftBadge && <span class="folder-index-badge">draft</span>}
              </span>
            ) : (
              <a href={resolveRelative(currentSlug, entry.slug)} class="internal">
                <span class="folder-index-title">{entry.title}</span>
              </a>
            )
          ) : (
            <span class="folder-index-title">{node.name}</span>
          )}
          {entry?.hint && <span class="folder-index-hint">{entry.hint}</span>}
          {childNodes.length > 0 && <ul>{childNodes.map(renderNode)}</ul>}
        </li>
      )
    }

    const topLevel = [...root.children.values()].sort((a, b) => a.name.localeCompare(b.name))
    return (
      <div class="folder-index popover-hint">
        <ul>{topLevel.map(renderNode)}</ul>
      </div>
    )
  }

  FolderIndex.css = style
  return FolderIndex
}) satisfies QuartzComponentConstructor<Partial<FolderIndexOptions>>
