import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const root = path.resolve(
  argument("root") || path.join(import.meta.dirname, ".."),
);
const target = argument("url") || "http://127.0.0.1:3100/";
const url = new URL(target);
if (!(
  ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
  (url.protocol === "https:" && argument("authorized-https") === "true")
))
  throw new Error(
    "Use localhost or an explicitly supplied authorized HTTPS destination",
  );
const output = path.resolve(
  argument("output") || path.join(root, "test-results/browser-context.json"),
);
const { chromium } = createRequire(path.join(root, "package.json"))(
  "playwright",
);
const reports = [];
for (const enabled of [false, true]) {
  const browser = await chromium.launch({
    headless: true,
    args: enabled ? ["--enable-features=WebMCP"] : [],
  });
  try {
    const context = await browser.newContext();
    // A new temporary profile; no real workspace/session cookies are read.
    await context.route("**/*", (route) =>
      new URL(route.request().url()).origin === url.origin
        ? route.continue()
        : route.abort(),
    );
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url.href, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .getByRole("textbox", { name: "Search cars" })
      .waitFor({ timeout: 30000 });
    const state = await page.evaluate(() => {
      const mc = document.modelContext;
      return {
        secureContext: window.isSecureContext,
        protocol: location.protocol,
        modelContextPresent: !!mc,
        methods: mc
          ? Object.fromEntries(
              ["registerTool", "getTools", "executeTool"].map((name) => [
                name,
                {
                  type: typeof mc[name],
                  native: /\[native code\]/.test(String(mc[name])),
                },
              ]),
            )
          : {},
        userAgent: navigator.userAgent,
      };
    });
    const report = {
      nativeFeatureFlag: enabled ? "--enable-features=WebMCP" : null,
      browserVersion: browser.version(),
      url: url.href,
      ...state,
      application: null,
      lifecycle: null,
      pageErrors: errors,
    };
    if (
      state.modelContextPresent &&
      Object.values(state.methods).every(
        (method) => method.type === "function" && method.native,
      )
    ) {
      // Poll the main world where the app registers. Playwright's isolated
      // waitForFunction world is not an equivalent native WebMCP caller.
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await page.evaluate(async () =>
            (await document.modelContext.getTools()).some(
              (tool) => tool.name === "search_musclescout",
            ),
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const priceControl = page.getByRole("spinbutton", {
        name: "Maximum asking price",
      });
      await priceControl.fill("45000");
      report.application = await page.evaluate(async () => {
        const mc = document.modelContext,
          tools = await mc.getTools(),
          tool = tools.find((t) => t.name === "search_musclescout");
        if (!tool)
          return { registered: false, toolNames: tools.map((t) => t.name) };
        const input = { query: "Camero", mode: "unknown-route" };
        let result,
          inputFormat = "object",
          objectInputError = null;
        try {
          result = await mc.executeTool(tool, input);
        } catch (error) {
          objectInputError = { name: error.name, message: error.message };
          // Chromium 153's verified IDL still takes DOMString inputArguments.
          // Record the draft/API mismatch and call that native signature.
          inputFormat = "json-string";
          result = await mc.executeTool(tool, JSON.stringify(input));
        }
        let invalidInputRejected = false,
          invalidInputError = null;
        try {
          await mc.executeTool(
            tool,
            inputFormat === "object"
              ? { mode: "diagnostic-invalid-mode" }
              : JSON.stringify({ mode: "diagnostic-invalid-mode" }),
          );
        } catch (error) {
          invalidInputRejected = true;
          invalidInputError = error.name;
        }
        return {
          registered: true,
          matchingToolCount: tools.filter(
            (t) => t.name === "search_musclescout",
          ).length,
          registeredInputSchemaType: typeof tool.inputSchema,
          inputFormat,
          objectInputError,
          executionResult: result,
          invalidInputRejected,
          invalidInputError,
        };
      });
      if (report.application.registered) {
        await page
          .getByRole("textbox", { name: "Search cars" })
          .filter({ visible: true })
          .waitFor();
        report.application.visibleQueryAfterExecution = await page
          .getByRole("textbox", { name: "Search cars" })
          .inputValue();
        report.application.preexistingMaxPrice = "45000";
        report.application.maxPriceAfterExecution =
          await priceControl.inputValue();
        report.application.unrelatedPriceFilterPreserved =
          report.application.maxPriceAfterExecution === "45000";
      }
      report.lifecycle = await page.evaluate(async (inputFormat) => {
        const mc = document.modelContext,
          registration = new AbortController(),
          name = "musclescout_diagnostic_echo";
        const encode = (value) =>
          inputFormat === "json-string" ? JSON.stringify(value) : value;
        const result = mc.registerTool(
          {
            name,
            description:
              "Temporary isolated diagnostic echo with no external actions",
            inputSchema: {
              type: "object",
              properties: { value: { type: "string" } },
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: async (input) => ({ echoed: input.value }),
          },
          { signal: registration.signal },
        );
        const registerReturnedPromise = result instanceof Promise;
        await result;
        const before = (await mc.getTools()).find((t) => t.name === name);
        const echo = before
          ? await mc.executeTool(before, encode({ value: "native-check" }))
          : null;
        registration.abort();
        const removedAfterAbort = !(await mc.getTools()).some(
          (t) => t.name === name,
        );
        const waitName = "musclescout_diagnostic_abort",
          owner = new AbortController(),
          caller = new AbortController();
        let receivedSignal = false,
          callbackStarted = false,
          callbackAborted = false;
        await mc.registerTool(
          {
            name: waitName,
            description: "Temporary isolated cancellation diagnostic",
            inputSchema: { type: "object" },
            annotations: { readOnlyHint: true },
            execute: async (_input, options) => {
              callbackStarted = true;
              receivedSignal = options.signal instanceof AbortSignal;
              return new Promise((_resolve, reject) => {
                options.signal.addEventListener(
                  "abort",
                  () => {
                    callbackAborted = true;
                    reject(options.signal.reason);
                  },
                  { once: true },
                );
              });
            },
          },
          { signal: owner.signal },
        );
        const waitTool = (await mc.getTools()).find((t) => t.name === waitName);
        const execution = mc
          .executeTool(waitTool, encode({}), { signal: caller.signal })
          .then(
            () => ({ cancelled: false }),
            (error) => ({ cancelled: true, error: error.name }),
          );
        for (let i = 0; !callbackStarted && i < 100; i++)
          await new Promise((resolve) => setTimeout(resolve, 10));
        caller.abort();
        const cancellation = await Promise.race([
          execution,
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ cancelled: false, timeout: true }),
              3000,
            ),
          ),
        ]);
        await new Promise((resolve) => setTimeout(resolve, 25));
        owner.abort();
        return {
          registerReturnedPromise,
          registered: !!before,
          echo,
          removedAfterAbort,
          callbackStarted,
          receivedSignal,
          callbackAborted,
          cancellation,
          remainingDiagnosticTools: (await mc.getTools()).filter((t) =>
            t.name.startsWith("musclescout_diagnostic_"),
          ).length,
        };
      }, report.application?.inputFormat || "json-string");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("textbox", { name: "Search cars" }).waitFor();
      for (let attempt = 0; attempt < 100; attempt++) {
        if (
          await page.evaluate(async () =>
            (await document.modelContext.getTools()).some(
              (tool) => tool.name === "search_musclescout",
            ),
          )
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      report.application.registrationCountAfterReload = await page.evaluate(
        async () =>
          (await document.modelContext.getTools()).filter(
            (t) => t.name === "search_musclescout",
          ).length,
      );
    }
    reports.push(report);
  } catch (error) {
    reports.push({
      nativeFeatureFlag: enabled,
      browserVersion: browser.version(),
      error: error.message,
    });
  } finally {
    await browser.close();
  }
}
const result = {
  observedAt: new Date().toISOString(),
  isolatedBrowserProfiles: true,
  polyfillUsed: false,
  externalRequestsBlocked: true,
  publicDeploymentTested: url.protocol === "https:",
  reports,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
