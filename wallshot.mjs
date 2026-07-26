import { chromium } from "playwright";
const outDir = process.env.OUT_DIR;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function ctxPage(colorScheme) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 1100 },
    colorScheme,
    locale: "zh-CN",
    extraHTTPHeaders: { "accept-language": "zh-CN,zh;q=0.9" },
  });
  return ctx.newPage();
}

// Light: full home
let page = await ctxPage("light");
await page.goto("http://127.0.0.1:3000/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2200);
await page.screenshot({ path: `${outDir}/wall-light.png`, fullPage: true });

// Open quick view on the first real tile
await page.click('button[aria-label="王秀兰"]').catch(() => console.log("no real tile"));
await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/wall-modal.png` });
await page.context().close();

// Dark: wall section + overview density
page = await ctxPage("dark");
await page.goto("http://127.0.0.1:3000/", { waitUntil: "load", timeout: 30000 });
await page.waitForTimeout(2200);
await page.click("text=纵览");
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/wall-dark-overview.png`, fullPage: true });
await page.context().close();

await browser.close();
console.log("done");
