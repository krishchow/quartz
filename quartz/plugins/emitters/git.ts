import { FilePath, joinSegments, pathToRoot } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import chalk from "chalk"
import DepGraph from "../../depgraph"
import { createGitHistoryParser } from "../../util/git-parser"
import { ProcessedContent } from "../vfile"
import path from "path"
import { FullPageLayout } from "../../cfg"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { Content } from "../../components"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { parseDependencies } from "./contentPage"
import { Root } from "hast"
import { pageResources, renderPage } from "../../components/renderPage"
import { QuartzComponentProps } from "../../components/types"
import { write } from "./helpers"

const CONTENT_DIR = "content"

// Function to dynamically get the absolute path to the project root
const getProjectRoot = () => {
    return process.cwd()
}

function strip(fullPath: string, prefix: string = CONTENT_DIR): string {
    // Normalize paths to handle different path separators and resolve '..' and '.'
    const normalizedFullPath = path.normalize(fullPath)
    const normalizedPrefix = path.normalize(prefix)

    // Check if the path actually starts with the prefix
    if (normalizedFullPath.startsWith(normalizedPrefix)) {
        // Remove the prefix
        let result = normalizedFullPath.slice(normalizedPrefix.length)

        // If the result starts with a path separator, remove it
        // This ensures we don't return paths starting with / or \
        if (result.startsWith(path.sep)) {
            result = result.slice(1)
        }

        return result
    }

    // Return the original path if it doesn't start with the prefix
    return fullPath
}

const parser = createGitHistoryParser(joinSegments(getProjectRoot(), CONTENT_DIR))

export const Git: QuartzEmitterPlugin<Partial<FullPageLayout>> = (userOpts) => {
    const opts: FullPageLayout = {
        ...sharedPageComponents,
        ...defaultContentPageLayout,
        pageBody: Content(),
        ...userOpts,
    }

    const { head: Head, header, beforeBody, pageBody, left, right, footer: Footer } = opts
    const Header = HeaderConstructor()
    const Body = BodyConstructor()

    return {
        name: "Git",
        getQuartzComponents() {
            return [
                Head,
                Header,
                Body,
                ...header,
                ...beforeBody,
                pageBody,
                ...left,
                ...right,
                Footer,
            ]
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

            let containsIndex = false
            for (const [tree, file] of content) {
                const slug = file.data.slug!
                if (slug === "index") {
                    containsIndex = true
                }

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

            if (!containsIndex && !ctx.argv.fastRebuild) {
                console.log(
                    chalk.yellow(
                        `\nWarning: you seem to be missing an \`index.md\` home page file at the root of your \`${ctx.argv.directory}\` folder. This may cause errors when deploying.`,
                    ),
                )
            }

            return fps
        },
    }
}