import { bench, script } from "@hona/strobe"

export default bench({
  targets: { app: script("./projects-groups.ts") },
  cases: {
    // 50 grouping passes over 200 session directories across 21 project roots.
    "group the sidebar sessions": {
      primary: "cpu.work",
      async run(ctx) {
        await ctx.call("group", 50)
      },
    },
  },
})
