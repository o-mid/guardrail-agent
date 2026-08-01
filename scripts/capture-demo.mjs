import { chromium } from "../apps/web/node_modules/playwright/index.mjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const outDir = path.resolve("docs/demo/screenshots");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

await page.goto(BASE, { waitUntil: "networkidle" });
await shot("01-landing.png");

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shot("02-login.png");

await page.fill('input[type="email"]', "demo@guardrail.local");
await page.fill('input[type="password"]', "demopass123");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("**/app**", { timeout: 20000 });
await shot("03-app-hub.png");

await page.goto(`${BASE}/app/compose`, { waitUntil: "networkidle" });
await shot("04-compose-empty.png");

await page.getByRole("button", { name: /Approve unlimited/i }).click();
await page.getByRole("button", { name: /Create plan/i }).click();
await page.waitForSelector("text=Plan rejected", { timeout: 20000 });
await page.waitForSelector("text=infinite_approve", { timeout: 5000 });
await shot("05-reject-infinite-approve.png");

await page.getByRole("button", { name: /Use example: Send 5 MOCK_USDC/i }).click();
await page.getByRole("button", { name: /Create plan/i }).click();
const approveBtn = page.getByRole("button", { name: /Approve step/i });
await approveBtn.waitFor({ timeout: 30000 });
await page.waitForSelector("text=awaiting approval", { timeout: 5000 });
await shot("06-plan-review-accept.png");

await approveBtn.click();
await page.waitForSelector("text=succeeded", { timeout: 45000 });
await page.waitForTimeout(500);
await shot("07-step-succeeded.png");

await page.goto(`${BASE}/app/audit`, { waitUntil: "networkidle" });
await page.waitForSelector("text=intent.received", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
await shot("08-audit.png");

await browser.close();
console.log("screenshots done");
