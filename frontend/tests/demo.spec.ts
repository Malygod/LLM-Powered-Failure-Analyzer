import { test, expect } from "@playwright/test";

test("three-minute walkthrough works without backend", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", (route) => route.abort());
  await page.goto("/");
  await expect(page).toHaveURL(/\/demo$/);
  await expect(
    page.getByRole("heading", { name: "Every run tells a story." }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Explore the regression/ }).click();
  await expect(
    page.getByRole("heading", {
      name: "Can I export logs older than 30 days?",
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Execution completed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Quality failed", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Open recorded investigation" })
    .click();
  await expect(
    page.getByText("Follow the evidence.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review 20 test results" }).click();
  await expect(page.locator(".test-cases details")).toHaveCount(20);
  await page.getByText("Incomplete retrieval", { exact: true }).click();
  await expect(
    page.locator(".test-cases").getByText(/archive must be enabled/),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report" }).click();
  expect((await download).suggestedFilename()).toBe(
    "causelab-investigation.json",
  );
  await page.getByRole("button", { name: "retrieve", exact: true }).click();
  await expect(page.locator(".inspector-heading h3")).toHaveText(
    "Retrieve knowledge",
  );
  expect(errors).toEqual([]);
});

test("filters, pagination and aggregate metrics are consistent", async ({
  page,
}) => {
  await page.goto("/demo");
  await expect(page.locator(".runs-table tbody tr")).toHaveCount(10);
  await expect(page.locator(".metric").first()).toContainText("20");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator(".metric").first()).toContainText("20");
  await page.getByLabel("Search runs").fill("older than");
  await expect(page.locator(".runs-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".metric").first()).toContainText("1");
  await page.getByLabel("Filter version").selectOption("all");
  await expect(page.locator(".runs-table tbody tr")).toHaveCount(3);
  await page.getByLabel("Filter status").selectOption("failed");
  await expect(page.locator(".runs-table tbody tr")).toHaveCount(1);
});

test("deep links, keyboard trace selection and narrow layouts", async ({
  page,
}) => {
  await page.goto("/demo/runs/faulty-knowledge-09");
  const compose = page.getByRole("button", {
    name: "Compose grounded answer llm",
    exact: true,
  });
  await compose.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".inspector-heading h3")).toHaveText(
    "Compose grounded answer",
  );
  await page
    .getByRole("button", { name: "Collapse Knowledge assistant", exact: true })
    .click();
  await expect(compose).not.toBeVisible();
  await page
    .getByRole("button", { name: "Expand Knowledge assistant", exact: true })
    .click();
  await expect(compose).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.goto("/demo/runs/not-a-run");
  await expect(
    page.getByRole("heading", { name: "This view isn’t available." }),
  ).toBeVisible();
});

test("comparison shows regressions and repaired behavior", async ({ page }) => {
  await page.goto("/demo/compare");
  await expect(page.locator(".compare-counts")).toContainText("12");
  await page.getByLabel("Baseline version").selectOption("faulty");
  await page.getByLabel("Candidate version").selectOption("repaired");
  await expect(page.getByText("Improvement", { exact: true })).toHaveCount(12);
  await page
    .getByText("Can I export logs older than 30 days?", { exact: true })
    .click();
  await expect(page.locator(".case-answers:visible")).toContainText(
    "cannot be recovered",
  );
});

test("about and public exposure boundaries", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "8/20 → 20/20 cases passing." }),
  ).toBeVisible();
  await page.goto("/live");
  await expect(
    page.getByRole("heading", { name: "This view isn’t available." }),
  ).toBeVisible();
  const image = await page.request.get("/opengraph-image");
  expect(image.ok()).toBeTruthy();
});
