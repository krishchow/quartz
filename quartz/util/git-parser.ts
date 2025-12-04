// git-history-parser.ts

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"

/**
 * Represents a file change in a commit
 */
export interface FileChange {
  path: string
  status: "added" | "modified" | "deleted" | "renamed"
  oldPath?: string // Only relevant for renamed files
}

/**
 * Represents a Git commit
 */
export interface Commit {
  hash: string
  shortHash: string
  author: string
  email: string
  date: Date
  message: string
  fileChanges: FileChange[]
}

/**
 * Main class for parsing Git history
 */
export class GitHistoryParser {
  private repoPath: string

  /**
   * Create a new GitHistoryParser instance
   * @param repoPath Path to the Git repository
   */
  constructor(repoPath: string) {
    this.repoPath = path.resolve(repoPath)

    if (!fs.existsSync(path.join(this.repoPath, ".git"))) {
      throw new Error(`${this.repoPath} is not a valid Git repository`)
    }
  }

  /**
   * Execute a Git command in the repository
   * @param command The Git command to execute
   * @returns The command output
   */
  private executeGitCommand(command: string): string {
    try {
      return execSync(`git ${command}`, {
        cwd: this.repoPath,
        encoding: "utf-8",
      }).trim()
    } catch (error) {
      throw new Error(`Git command failed: ${error}`)
    }
  }

  /**
   * Get all commits from the repository history
   * @param branch The branch to get history from, defaults to current branch
   * @param maxCount Maximum number of commits to retrieve (optional)
   * @returns List of commits
   */
  public getCommits({ branch, maxCount }: { branch?: string; maxCount?: number }): Commit[] {
    let command = 'log --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso'

    if (branch) {
      command += ` ${branch}`
    }

    if (maxCount && maxCount > 0) {
      command += ` -${maxCount}`
    }

    const output = this.executeGitCommand(command)
    if (!output) return []

    const commits: Commit[] = output.split("\n").map((line) => {
      const [hash, shortHash, author, email, dateStr, message] = line.split("|")

      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        fileChanges: this.getFilesChangedInCommit(hash),
      }
    })

    return commits
  }

  /**
   * Get files changed in a specific commit
   * @param commitHash The commit hash to inspect
   * @returns List of file changes
   */
  public getFilesChangedInCommit(commitHash: string): FileChange[] {
    const output = this.executeGitCommand(`show --name-status --format="" ${commitHash}`)
    if (!output) return []

    const fileChanges: FileChange[] = []

    output.split("\n").forEach((line) => {
      if (!line.trim()) return

      const [statusCode, ...pathParts] = line.split("\t")

      if (statusCode.startsWith("R")) {
        // Handle renamed files
        fileChanges.push({
          status: "renamed",
          oldPath: pathParts[0],
          path: pathParts[1],
        })
      } else {
        const status = statusCode === "A" ? "added" : statusCode === "M" ? "modified" : "deleted"

        fileChanges.push({
          status: status as FileChange["status"],
          path: pathParts[0],
        })
      }
    })

    return fileChanges
  }

  /**
   * Get the diff for a specific file at a specific revision
   * @param filePath Path to the file
   * @param commitHash The commit hash
   * @returns The diff content
   */
  public getFileDiffAtRevision(filePath: string, commitHash: string): string {
    try {
      return this.executeGitCommand(`show ${commitHash}:${filePath}`)
    } catch (error) {
      throw new Error(`Could not get file at revision: ${error}`)
    }
  }

  /**
   * Get the diff between two revisions of a file
   * @param filePath Path to the file
   * @param oldCommitHash The older commit hash
   * @param newCommitHash The newer commit hash
   * @returns The diff between the two revisions
   */
  public getFileDiffBetweenRevisions(
    filePath: string,
    oldCommitHash: string,
    newCommitHash: string,
  ): string {
    try {
      return this.executeGitCommand(
        `diff ${oldCommitHash}:${filePath} ${newCommitHash}:${filePath}`,
      )
    } catch (error) {
      throw new Error(`Could not get diff between revisions: ${error}`)
    }
  }

  /**
   * Get the history of a specific file
   * @param filePath Path to the file
   * @returns List of commits that modified the file
   */
  public getFileHistory(filePath: string): Commit[] {
    const output = this.executeGitCommand(
      `log --follow --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso -- ${filePath}`,
    )
    if (!output) return []

    const commits: Commit[] = output.split("\n").map((line) => {
      const [hash, shortHash, author, email, dateStr, message] = line.split("|")

      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        fileChanges: this.getFilesChangedInCommit(hash).filter(
          (change) => change.path === filePath || change.oldPath === filePath,
        ),
      }
    })

    return commits
  }

  /**
   * Get the last commit that modified a specific file
   * @param filePath Path to the file
   * @returns The last commit that modified the file, or null if the file doesn't exist in the repository
   */
  public getLastCommitForFile(filePath: string): Commit | null {
    try {
      const output = this.executeGitCommand(
        `log -n 1 --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso -- ${filePath}`,
      )
      if (!output) return null

      const [hash, shortHash, author, email, dateStr, message] = output.split("|")

      return {
        hash,
        shortHash,
        author,
        email,
        date: new Date(dateStr),
        message,
        fileChanges: this.getFilesChangedInCommit(hash).filter(
          (change) => change.path === filePath || change.oldPath === filePath,
        ),
      }
    } catch (error) {
      return null
    }
  }

  /**
   * Get the last 2 commit that modified a specific file
   * @param filePath Path to the file
   * @returns The last commit that modified the file, or null if the file doesn't exist in the repository
   */
  public getLastTwoCommitsForFile(filePath: string): Commit[] | null {
    try {
      const output = this.executeGitCommand(
        `log -n 2 --pretty=format:"%H|%h|%an|%ae|%ad|%s" --date=iso -- ${filePath}`,
      )
      if (!output) return null

      const commits: Commit[] = output.split("\n").map((line) => {
        const [hash, shortHash, author, email, dateStr, message] = line.split("|")

        return {
          hash,
          shortHash,
          author,
          email,
          date: new Date(dateStr),
          message,
          fileChanges: this.getFilesChangedInCommit(hash).filter(
            (change) => change.path === filePath || change.oldPath === filePath,
          ),
        }
      })

      return commits
    } catch (error) {
      return null
    }
  }
}

// Export a factory function for easier usage
export function createGitHistoryParser(repoPath: string): GitHistoryParser {
  return new GitHistoryParser(repoPath)
}

export function fileChangeStatus(fileChanges: FileChange[], filePath?: string) {
  for (let i = 0; i < fileChanges.length; i++) {
    const fc = fileChanges[i]
    if (fc.path == filePath) {
      return fc.status
    }
  }
}
