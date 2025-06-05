import { Git } from "../plugins";
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface Options {
  gitSha: string
}

export default ((opts?: Options) => {
  const HeaderGit: QuartzComponent = (props: QuartzComponentProps) => {
    const sha = props.fileData.git;
    return <header>Hash: {sha?.hash}</header>
  }

  HeaderGit.css = `
    header {
      display: flex;
      flex-direction: row;
      align-items: center;
      margin: 2rem 0;
      gap: 1.5rem;
    }
  
    header h1 {
      margin: 0;
      flex: auto;
    }
  `
  return HeaderGit
}) satisfies QuartzComponentConstructor
