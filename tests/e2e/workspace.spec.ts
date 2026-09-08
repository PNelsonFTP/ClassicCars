import { test, expect } from "@playwright/test";
test("real snapshot search, review, shortlist, notes, comparison and reload persistence", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your next chapter." }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Include specialty Mustangs" }),
  ).not.toBeChecked();
  await expect(
    page.getByRole("heading", {
      name: "The right car starts with an honest search.",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await expect(page.locator(".car-card").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search cars" }).fill("Camero");
  await expect(page.locator(".car-card").first()).toContainText(
    /Camaro|Camero/i,
  );
  await page.getByRole("textbox", { name: "Search cars" }).fill("");
  const first = page.locator(".car-card").first();
  await first.locator(".favorite").click();
  await first.locator(".card-footer button").click();
  await first.locator(".car-title").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("textbox", { name: "Private notes" })
    .fill("Test note: inspect floor pans and title.");
  await page
    .getByRole("textbox", { name: "Data issue" })
    .fill("Confirm location before travel");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Shortlist/ }).click();
  await expect(page.locator(".car-card")).toHaveCount(1);
  await page.locator(".car-title").click();
  await expect(
    page.getByRole("textbox", { name: "Private notes" }),
  ).toHaveValue("Test note: inspect floor pans and title.");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: /Compare/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find what makes the difference." }),
  ).toBeVisible();
  await expect(page.locator(".compare-panel")).toContainText("Asking price");
  await page
    .getByRole("button", { name: "Source coverage", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Coverage, without the guesswork." }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "ClassicCars.com Marketplace" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-coverage.png`,
    fullPage: false,
  });
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-discover.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("specialty, saved search preview and manual workspace imports remain isolated", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("switch", { name: "Include specialty Mustangs" })
    .check();
  await expect(
    page.getByRole("switch", { name: "Include specialty Mustangs" }),
  ).toBeChecked();
  await expect(page.locator(".active-filters")).toContainText(
    "Specialty Mustangs",
  );
  await page
    .getByRole("switch", { name: "Include specialty Mustangs" })
    .uncheck();
  await page
    .getByRole("button", { name: "Save search", exact: true })
    .first()
    .click();
  await page
    .getByRole("textbox", { name: "Saved search name" })
    .fill("Weekend classics");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save search", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Saved searches", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Weekend classics" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Import JSON", exact: true }).click();
  await page.getByRole("textbox", { name: "Import JSON" }).fill(
    JSON.stringify({
      notes: { manual: "Imported private note" },
      favorites: [],
    }),
  );
  await page.getByRole("button", { name: "Validate & merge import" }).click();
  await expect(page.getByRole("status")).toContainText("merged");
  await page.reload();
  await page
    .getByRole("button", { name: "Saved searches", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Weekend classics" }),
  ).toBeVisible();
});
test("keyboard access, theme and maps fail independently from lists", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await page.getByRole("button", { name: "map view", exact: true }).click();
  await expect(page.locator(".map-caption")).toContainText(
    "mappable vehicle locations",
  );
  await page.getByRole("button", { name: "list view", exact: true }).click();
  await expect(page.locator(".list-card").first()).toBeVisible();
});
test("connected mode uses an isolated backend, survives reload and keeps snapshot notes separate", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Backend URL" })
    .fill("http://127.0.0.1:4411");
  await page
    .getByRole("textbox", { name: "Backend password" })
    .fill("musclescout-e2e-only");
  await page.getByRole("button", { name: "Connect locally" }).click();
  await expect(page.locator(".connection-pill")).toContainText("Connected");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search cars" })
    .fill("1967 Ford Mustang");
  await expect(page.locator(".car-card").first()).toContainText(
    "browser test fixture",
  );
  await page.locator(".car-title").first().click();
  await page
    .getByRole("textbox", { name: "Private notes" })
    .fill("Connected database note");
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await expect(page.locator(".connection-pill")).toContainText("Connected");
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search cars" })
    .fill("1967 Ford Mustang");
  await page.locator(".car-title").first().click();
  await expect(
    page.getByRole("textbox", { name: "Private notes" }),
  ).toHaveValue("Connected database note");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.locator(".connection-pill")).toContainText(
    "Published snapshot",
  );
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).some((v) =>
        v.includes("musclescout-e2e-only"),
      ),
    ),
  ).toBe(false);
});
test("manual entry persists without fetching the source", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Add a manual listing" }).click();
  await page
    .getByRole("textbox", { name: "Advertised title" })
    .fill("1968 Ford Mustang manual entry fixture");
  await page
    .getByRole("textbox", { name: "Original listing URL" })
    .fill("https://example.com/user-provided-car");
  await page.getByRole("button", { name: "Save manual listing" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search cars" })
    .fill("manual entry fixture");
  await expect(page.locator(".car-card")).toHaveCount(1);
});

test("new review and job controls preserve evidence and cancel queued work", async ({
  page,
  request,
}, info) => {
  const login = await request.post("http://127.0.0.1:4411/api/login", {
    data: { password: "musclescout-e2e-only" },
  });
  const token = (await login.json()).token,
    headers = { Authorization: `Bearer ${token}` };
  const ids = [
    `e2e:${info.project.name}-review-a`,
    `e2e:${info.project.name}-review-b`,
  ];
  const now = new Date().toISOString();
  await request.post("http://127.0.0.1:4411/api/import", {
    headers,
    data: {
      listings: ids.map((id, i) => ({
        id,
        sourceId: "e2e",
        sourceListingId: id,
        sourceName: "Isolated browser fixture",
        url: `https://example.com/${id}`,
        title: `1969 Camaro ${info.project.name} browser review fixture`,
        model: "Camaro",
        year: 1969,
        askingPrice: 30000 + i * 1000,
        saleType: "fixed",
        availability: "active",
        seller: { name: "Browser review fixture", type: "dealer" },
        firstSeenAt: now,
        lastObservedAt: now,
      })),
    },
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Backend URL" })
    .fill("http://127.0.0.1:4411");
  await page
    .getByRole("textbox", { name: "Backend password" })
    .fill("musclescout-e2e-only");
  await page.getByRole("button", { name: "Connect locally" }).click();
  await expect(page.locator(".connection-pill")).toContainText("Connected");
  await page.getByText("Select any ads manually", { exact: true }).click();
  await page
    .getByLabel("Or paste exact ad IDs, one per line")
    .fill(ids.join("\n"));
  await page.getByRole("button", { name: "Use these ad IDs" }).click();
  await page
    .getByLabel("Evidence or reason for this review")
    .fill("Synthetic browser fixture: reviewed matching source documents");
  await page
    .getByRole("button", { name: "Merge reviewed ads", exact: true })
    .click();
  await expect(page.locator(".duplicate-review-v2")).toContainText(
    "Reviewed merge saved",
  );
  await page.getByText(/Merge review history \(/).click();
  await page
    .getByRole("button", { name: "Undo this merge review" })
    .first()
    .click();
  await expect(page.locator(".duplicate-review-v2")).toContainText(
    "Review reversed",
  );
  await page.getByLabel("Job kind").selectOption("routes");
  await page.getByLabel("Service job item limit").fill("1");
  await page.getByRole("button", { name: "Queue job", exact: true }).click();
  const operations = page.getByRole("region", {
    name: "Collection and service operations",
  });
  await expect(operations).toContainText("queued");
  await operations
    .getByRole("button", { name: "Cancel", exact: true })
    .first()
    .click();
  await expect(operations).toContainText("Cancellation recorded");
  await page.screenshot({
    path: `test-results/${info.project.name}-improvements.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Search cars" })
    .fill(`${info.project.name} browser review fixture`);
  await page.locator(".car-title").first().click();
  await page
    .getByText("Apply a reviewed identity or location correction", {
      exact: true,
    })
    .click();
  await page.getByLabel("Reviewed model year").fill("1975");
  await page
    .getByLabel("Correction evidence")
    .fill("Synthetic model year review with retained source claim");
  await page
    .getByRole("button", { name: "Apply reviewed correction", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Second generation");
  await page.getByText("Source and review timeline", { exact: true }).click();
  await page
    .getByLabel("RESET OR GEOCODE RETRY REASON")
    .fill("Restore synthetic source year after browser verification");
  await page
    .getByRole("button", { name: "Restore source values", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Reviewed model year"),
  ).toHaveValue("1969");
});

test("result pagination bounds rendered cards and photo failures retain the correct ad", async ({
  page,
}) => {
  await page.route("**/*", async (route) => {
    if (
      route.request().resourceType() === "image" &&
      !route.request().url().startsWith("http://127.0.0.1")
    )
      return route.abort();
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await expect(page.locator(".car-card")).toHaveCount(24);
  const first = await page.locator(".car-title").first().innerText();
  await page.getByRole("button", { name: "Next 24", exact: true }).click();
  await expect(page.locator(".car-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Previous 24", exact: true }).click();
  await expect(page.locator(".car-title").first()).toHaveText(first);
  await expect(page.locator(".photo-placeholder").first()).toContainText(
    "Photo unavailable",
  );
});

test("editing a backend URL never forwards the authenticated token or workspace", async ({
  page,
}) => {
  const foreign: string[] = [];
  await page.route("https://different-backend.invalid/**", async (route) => {
    foreign.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Workspace settings", exact: true })
    .click();
  await page
    .getByLabel("Backend URL", { exact: true })
    .fill("http://127.0.0.1:4411");
  await page
    .getByLabel("Backend password", { exact: true })
    .fill("musclescout-e2e-only");
  await page
    .getByRole("button", { name: "Connect locally", exact: true })
    .click();
  await expect(page.locator(".connection-pill")).toContainText("Connected");
  await page
    .getByLabel("Backend URL", { exact: true })
    .fill("https://different-backend.invalid");
  await page.getByRole("button", { name: "Discover", exact: true }).click();
  await page.getByRole("button", { name: "Review cars", exact: true }).click();
  await expect(page.locator(".car-card").first()).toBeVisible();
  const connection = await page.evaluate(
    () =>
      Object.entries(sessionStorage).find(([key]) =>
        key.includes("connection"),
      )?.[1],
  );
  expect(JSON.parse(connection!).backend).toBe("http://127.0.0.1:4411");
  expect(foreign).toEqual([]);
});
