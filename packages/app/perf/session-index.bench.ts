import { bench, script } from "@hona/strobe"

export default bench({
  targets: { app: script("./session-index.ts") },
  cases: {
    // 200 merges of a 50-row index page with a 5,000-session known list.
    "merge the session index": {
      primary: "cpu.work",
      async run(ctx) {
        await ctx.call("merge", 200)
      },
    },
  },
})
