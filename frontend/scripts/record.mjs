import { chromium } from "@playwright/test";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: "artifacts", size: { width: 1440, height: 1000 } },
});
const page = await context.newPage();
const video = page.video();
await page.goto("http://127.0.0.1:3000/demo");
await page.getByRole("heading", { name: "Every run tells a story." }).waitFor();
await page.screenshot({ path: "artifacts/dashboard.png", fullPage: true });
await page.waitForTimeout(2500);
await page.getByRole("link", { name: /Explore the regression/ }).click();
await page.waitForTimeout(2500);
await page
  .getByRole("button", { name: "Compose grounded answer llm", exact: true })
  .click();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Open recorded investigation" }).click();
await page.locator(".report").scrollIntoViewIfNeeded();
await page.waitForTimeout(3000);
await page.getByRole("button", { name: "Review 20 test results" }).click();
await page.getByText("Incomplete retrieval", { exact: true }).click();
await page
  .getByText("Incomplete retrieval", { exact: true })
  .scrollIntoViewIfNeeded();
await page.waitForTimeout(3500);
await page.goto("http://127.0.0.1:3000/demo/compare");
await page.getByLabel("Baseline version").selectOption("faulty");
await page.getByLabel("Candidate version").selectOption("repaired");
await page.waitForTimeout(2500);
await context.close();
await copyFile(await video.path(), "public/walkthrough.webm");
await writeFile(
  "artifacts/recording-note.txt",
  "Browser recording of the simulated public demo. No model calls. Regenerate with npm run record.\n",
);
await browser.close();
