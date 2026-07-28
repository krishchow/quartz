import { QuartzConfig } from "../cfg"
import { FullSlug } from "./path"

export interface Argv {
  directory: string
  verbose: boolean
  output: string
  serve: boolean
  fastRebuild: boolean
  port: number
  wsPort: number
  remoteDevHost?: string
  concurrency?: number
}

export interface FilteredFileMeta {
  slug: FullSlug
  title: string
  hint?: string
  draft: boolean
  filteredBy: string
}

export interface BuildCtx {
  argv: Argv
  cfg: QuartzConfig
  allSlugs: FullSlug[]
  // lightweight metadata for files removed by the filter pipeline
  // (e.g. drafts) so components can still list them without emitting them
  filteredMeta?: FilteredFileMeta[]
}
