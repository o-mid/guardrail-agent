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
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});

// Keep the guide from covering screenshots unless we want it.
await context.addInitScript(() => {
  localStorage.setItem(
    "ga-guide-v3",
    JSON.stringify({ open: false, step: 0, dismissed: true }),
  );
});

const page = await context.newPage();

async function shot(name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

async function pickExample(text) {
  await page.getByRole("button", { name: `Use example: ${text}`, exact: true }).click();
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
await page.waitForSelector("text=Examples", { timeout: 10000 });
await shot("04-compose-empty.png");

await pickExample("Approve unlimited MOCK_USDC for 0xEvil");
await page.getByRole("button", { name: /Create plan/i }).click();
await page.waitForSelector("text=Plan rejected", { timeout: 20000 });
await page.waitForSelector("text=infinite_approve", { timeout: 5000 });
await shot("05-reject-infinite-approve.png");

await pickExample("Send 5 MOCK_USDC to Alice");
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
await page.waitForSelector("text=Audit", { timeout: 10000 });
await page.waitForTimeout(800);
await shot("08-audit.png");

// Guide overlay shot — reopen from the floating control
await page.getByRole("button", { name: "Open guide" }).click();
await page.waitForSelector("#guide-panel", { timeout: 10000 });
// jump to Compose step in the tour for a useful frame
const composeStep = page.getByRole("button", { name: /Step 3: Compose/i });
if (await composeStep.count()) await composeStep.click();
await page.waitForTimeout(400);
await shot("09-operator-guide.png");

await browser.close();
console.log("screenshots done");
