import { FilePath, getProjectRoot, isFullSlug, joinSegments, pathToRoot } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import DepGraph from "../../depgraph"
import { createGitHistoryParser } from "../../util/git-parser"
import { FullPageLayout } from "../../cfg"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import BodyConstructor from "../../components/Body"
import HeaderConstructor from "../../components/Header"
import { parseDependencies } from "./contentPage"
import { Root } from "hast"
import { pageResources, renderPage } from "../../components/renderPage"
import { QuartzComponentProps } from "../../components/types"
import { write } from "./helpers"

const CONTENT_DIR = "content"

const parser = createGitHistoryParser(joinSegments(getProjectRoot(), CONTENT_DIR))

export const Git: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultContentPageLayout,
    pageBody: Content(),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts

  const commits = parser.getCommits({ maxCount: 1 })

  const mostRecentCommit = commits[0]

  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "Git",
    getQuartzComponents() {
      return [Head, Header, Body, ...header, ...beforeBody, pageBody, ...left, ...right, Footer]
    },
    async getDependencyGraph(ctx, content, _resources) {
      const graph = new DepGraph<FilePath>()

      for (const [tree, file] of content) {
        const sourcePath = file.data.filePath!
        const slug = file.data.slug!
        graph.addEdge(sourcePath, joinSegments(ctx.argv.output, slug + ".html") as FilePath)

        parseDependencies(ctx.argv, tree as Root, file).forEach((dep) => {
          graph.addEdge(dep as FilePath, sourcePath)
        })
      }

      return graph
    },
    async emit(ctx, content, resources): Promise<FilePath[]> {
      const cfg = ctx.cfg.configuration
      const fps: FilePath[] = []
      const allFiles = content.map((c) => c[1].data)

      // TODO: this should work for changed and added files, but we will want another codepath
      // for deleted files, and maybe another for renamed.
      // deleted should render a special page like 404
      // renamed should do a symlink 302 type page.
      const changedFiles = new Set(
        mostRecentCommit.fileChanges
          .filter((fc) => fc.status === "added" || fc.status === "modified")
          .map((fc) => fc.path),
      )

      for (const [tree, file] of content) {
        if (!file.data.relativePath) {
          console.warn("Missing relative path")
          continue
        }
        if (!changedFiles.has(file.data.relativePath?.toString())) {
          // file not touched in most recent commit. skipping.
          continue
        }

        const slug = `${file.data.slug!}+${mostRecentCommit.hash}`

        if (!isFullSlug(slug)) continue

        const externalResources = pageResources(pathToRoot(slug), resources)
        const componentData: QuartzComponentProps = {
          ctx,
          fileData: file.data,
          externalResources,
          cfg,
          children: [],
          tree,
          allFiles,
        }

        const content = renderPage(cfg, slug, componentData, opts, externalResources)
        const fp = await write({
          ctx,
          content,
          slug,
          ext: ".html",
        })

        fps.push(fp)
      }

      return fps
    },
  }
}
