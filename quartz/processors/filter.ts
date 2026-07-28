import { BuildCtx, FilteredFileMeta } from "../util/ctx"
import { PerfTimer } from "../util/perf"
import { ProcessedContent } from "../plugins/vfile"

export function filterContent(ctx: BuildCtx, content: ProcessedContent[]): ProcessedContent[] {
  const { cfg, argv } = ctx
  const perf = new PerfTimer()
  const initialLength = content.length
  const filteredMeta: FilteredFileMeta[] = []
  for (const plugin of cfg.plugins.filters) {
    const updatedContent = content.filter((item) => plugin.shouldPublish(ctx, item))

    const removed = new Set(updatedContent)
    for (const file of content) {
      if (!removed.has(file)) {
        const data = file[1].data
        filteredMeta.push({
          slug: data.slug!,
          title: data.frontmatter?.title ?? data.slug!,
          hint: (data.frontmatter?.hint as string | undefined) ?? data.frontmatter?.description,
          draft: data.frontmatter?.draft ?? false,
          filteredBy: plugin.name,
        })
        if (argv.verbose) {
          console.log(`[filter:${plugin.name}] ${data.slug}`)
        }
      }
    }

    content = updatedContent
  }

  // store metadata (never content) for filtered-out files so
  // components can list them without emitting or linking them
  ctx.filteredMeta = filteredMeta

  console.log(`Filtered out ${initialLength - content.length} files in ${perf.timeSince()}`)
  return content
}
