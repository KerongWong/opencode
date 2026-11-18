import { chromium } from "@playwright/test"
import { execSync } from "node:child_process"

const CDP = "http://127.0.0.1:9222"
const REPO = "C:\\Users\\theso\\AppData\\Local\\Temp\\opencode\\repro-repo"

const browser = await chromium.connectOverCDP(CDP)
const allPages = browser.contexts().flatMap((c) => c.pages())
const page = allPages.find((p) => p.url().includes("app://") || p.url().startsWith("http")) ?? allPages[0]
if (!page) throw new Error("no page")

const requests: string[] = []
const consoleLines: string[] = []
page.on("request", (r) => {
  const u = r.url()
  if (u.includes("/api/")) requests.push(`${r.method()} ${u.replace(/^https?:\/\/[^/]+/, "")}`)
})
page.on("console", (m) => {
  const t = m.text()
  if (!t.includes("serviceWorker")) consoleLines.push(`[${m.type()}] ${t}`)
})

const shot = (n: string) => page.screenshot({ path: `C:\\Users\\theso\\AppData\\Local\\Temp\\opencode\\repro-${n}.png` })
const state = async (label: string) => {
  const url = page.url()
  const btn = await page.evaluate(() => {
    const el = document.querySelector('[data-component="session-composer-dock"] button:last-of-type, [contenteditable]') as HTMLElement | null
    const send = [...document.querySelectorAll("button")].find((b) => b.closest('[data-component="session-composer-dock"]') || b.getAttribute("aria-label")?.includes("发送") || b.getAttribute("aria-label")?.includes("Send"))
    return {
      url: location.href,
      sendDisabled: send ? (send as HTMLButtonElement).disabled : null,
      sendClass: send?.className?.slice(0, 80) ?? null,
      preparing: !!document.querySelector('[data-component="session-preparing"]'),
      bodyTextSnippet: document.body.innerText.slice(0, 200).replace(/\s+/g, " "),
    }
  })
  console.log(`--- ${label} ---`)
  console.log(JSON.stringify(btn))
  console.log(`api requests so far: ${requests.length}; last 5: ${requests.slice(-5).join(" | ")}`)
  console.log(`console last 5: ${consoleLines.slice(-5).join(" || ")}`)
}

console.log("page:", page.url(), page.title())
// dismiss any modal
for (let i = 0; i < 3; i++) {
  await page.keyboard.press("Escape")
  await page.waitForTimeout(400)
}
await state("start")

// ---- control: normal new session ----
await page.getByText("新建会话", { exact: true }).first().click()
await page.waitForTimeout(2500)
await state("after new-session click")
const composer = page.locator("[contenteditable]").last()
await composer.click()
await page.keyboard.type("repro control ping")
await page.waitForTimeout(300)
requests.length = 0
await page.keyboard.press("Enter")
await page.waitForTimeout(8000)
await state("control: 8s after send")

// ---- repro: Add local folder via native dialog + SendKeys ----
await page.getByText("Add local folder", { exact: true }).first().click()
await page.waitForTimeout(3000)
try {
  execSync(`powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; $w.AppActivate('选择文件夹'); Start-Sleep -Milliseconds 400; $w.SendKeys('^l'); Start-Sleep -Milliseconds 400; $w.SendKeys('${REPO}'); Start-Sleep -Milliseconds 400; $w.SendKeys('{ENTER}')"`)
} catch (e) {
  console.log("sendkeys err", String(e).slice(0, 200))
}
await page.waitForTimeout(4000)
await state("after add-folder")
await shot("after-add")

// the auto-opened draft should be focused; type and send
const draftComposer = page.locator("[contenteditable]").last()
await draftComposer.click()
await page.keyboard.type("repro hang test")
await page.waitForTimeout(300)
requests.length = 0
consoleLines.length = 0
await page.keyboard.press("Enter")
await page.waitForTimeout(3000)
await state("repro: 3s after send")
await page.waitForTimeout(10000)
await state("repro: 13s after send")
await page.waitForTimeout(15000)
await state("repro: 28s after send")
await shot("after-send")

console.log("=== DONE ===")
await browser.close()
