import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import styles from "./styles/permalink.scss"
import { classNames } from "../util/lang"
import { i18n } from "../i18n"
import { fileChangeStatus } from "../util/git-parser"

interface Options {
  gitSha: string
}

export default ((opts?: Options) => {
  const PermalinkNav: QuartzComponent = ({ displayClass, fileData, cfg }: QuartzComponentProps) => {
    const commits = fileData.git

    if (!commits || commits.length < 2) {
      return <></>
    }

    let current_rev = commits[0]
    let last_rev = commits[1]

    console.log(current_rev)
    console.log(last_rev)

    const status = fileChangeStatus(current_rev.fileChanges, fileData.relativePath?.toString())

    if (status == "added") {
      return <></>
    }

    const href = `/${fileData.slug!}+${last_rev.hash}`

    return (
      <a href={href} class={classNames(displayClass, "permalinkNav")}>
        <div class={classNames(displayClass, "permalinkNav")}>
          Previous revision: {last_rev.shortHash}
        </div>
      </a>
    )
  }

  PermalinkNav.css = styles

  return PermalinkNav
}) satisfies QuartzComponentConstructor
