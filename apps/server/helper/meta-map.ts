import * as fs from "node:fs/promises"
import * as path from "node:path"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import chokidar from "chokidar"
import { glob } from "glob"

const __dirname = dirname(fileURLToPath(import.meta.url))

async function generateMetaMap() {
  const files = await glob("./client/pages/(main)/**/metadata.ts", {
    cwd: path.resolve(__dirname, ".."),
  })

  const imports: string[] = []
  const routes: Record<string, string> = {}

  files.forEach((file, index) => {
    const routePath = file
      .replace("client/pages/(main)", "")
      .replace("/metadata.ts", "")
      .replaceAll(/\[([^\]]+)\]/g, ":$1")

    const importName = `i${index}`
    imports.push(`import ${importName} from "../${file.replace(".ts", "")}"`)
    routes[routePath] = importName
  })

  const content =
    "// This file is generated by `pnpm run meta`\n" +
    `${imports.join("\n")}\n
export default {
${Object.entries(routes)
  .map(([route, imp]) => `  "${route}": ${imp},`)
  .join("\n")}
}
`

  const originalContent = await fs.readFile(
    path.resolve(__dirname, "../src/meta-handler.map.ts"),
    "utf-8",
  )
  if (originalContent === content) return
  await fs.writeFile(path.resolve(__dirname, "../src/meta-handler.map.ts"), content, "utf-8")
  console.info("Meta map generated successfully!")
}

async function watch() {
  const watchPath = path.resolve(__dirname, "..", "./client/pages/(main)")
  console.info("Watching metadata files...")

  await generateMetaMap()
  const watcher = chokidar.watch(watchPath, {
    ignoreInitial: false,
  })

  watcher.on("add", () => {
    console.info("Metadata file added/changed, regenerating map...")
    generateMetaMap()
  })

  watcher.on("unlink", () => {
    console.info("Metadata file removed, regenerating map...")
    generateMetaMap()
  })

  watcher.on("change", () => {
    console.info("Metadata file changed, regenerating map...")
    generateMetaMap()
  })

  process.on("SIGINT", () => {
    watcher.close()
    process.exit(0)
  })
}

if (process.argv.includes("--watch")) {
  watch().catch(console.error)
} else {
  generateMetaMap().catch(console.error)
}