// Mirrors filename() in packages/cli/src/services/service-config.ts. The bundled CLI registers
// the background service under this name, so the desktop must probe exactly the same file:
// dev/beta register service.json while fork registers service-fork.json, and probing the wrong
// one makes ensure() wait on a registration that never appears (or kill a stranger's service).
export function registrationFile(channel: string) {
  if (channel === "latest" || channel === "dev" || channel === "beta" || channel === "next") return "service.json"

  return `service-${channel.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`
}
