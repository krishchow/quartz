import { QuartzTransformerPlugin } from "../types"
import { getProjectRoot, joinSegments } from "../../util/path"
import { Commit, createGitHistoryParser } from "../../util/git-parser"

export interface Options {}

const CONTENT_DIR = "content"

const parser = createGitHistoryParser(joinSegments(getProjectRoot(), CONTENT_DIR))

export const GitMetadata: QuartzTransformerPlugin<Partial<Options> | undefined> = (userOpts) => {
  const opts = { ...userOpts }

  const commits = parser.getCommits({ maxCount: 1 })

  const mostRecentCommit = commits[0]

  return {
    name: "Git",
    markdownPlugins({}) {
      return [
        () => {
          return (_, file) => {
            // fill in git metadata
            // file.data.git = mostRecentCommit;
            file.data.mostRecentCommit = mostRecentCommit

            if (file.data.relativePath) {
              // file.data.git = parser.getLastCommitForFile(file.data.relativePath?.toString())
              file.data.git = parser.getLastTwoCommitsForFile(file.data.relativePath?.toString())
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    git?: Commit[] | null
    mostRecentCommit: Commit
  }
}
