import { $ } from "bun"
import { resolveChannel } from "./utils"

const arg = process.argv[2]

// The projects and test channels have no dedicated icon set; they fall back to the dev icons just like the
// fork channel did (there is no ./icons/projects directory).
const channel =
  arg === "projects" || arg === "test"
    ? "dev"
    : arg === "dev" || arg === "beta" || arg === "prod"
      ? arg
      : resolveChannel()

const src = `./icons/${channel}`

const dest = "resources/icons"

await $`rm -rf ${dest}`

await $`cp -R ${src} ${dest}`

console.log(`Copied ${channel} icons from ${src} to ${dest}`)
