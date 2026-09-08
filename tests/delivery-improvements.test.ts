import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
  reserve: vi.fn(),
}));
vi.mock("../server/safe-fetch", () => ({ safeRequest: mocks.request }));
vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}));
vi.mock("../server/service-budget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../server/service-budget")>()),
  reserveServiceRequest: mocks.reserve,
}));
const folder = mkdtempSync(join(tmpdir(), "musclescout-delivery-db-"));
process.env.DATABASE_URL = `file:${folder}/test.db`;
let alerts: typeof import("../server/alerts"),
  db: (typeof import("../server/db"))["db"],
  store: typeof import("../server/store");
beforeAll(async () => {
  const Database = createRequire(import.meta.url)("better-sqlite3"),
    sqlite = new Database(`${folder}/test.db`);
  const root = process.env.MUSCLESCOUT_TEST_PROJECT ?? process.cwd();
  for (const dir of readdirSync(join(root, "prisma/migrations")).sort()) {
    const sql = join(root, "prisma/migrations", dir, "migration.sql");
    if (existsSync(sql)) sqlite.exec(readFileSync(sql, "utf8"));
  }
  sqlite.close();
  ({ db } = await import("../server/db"));
  alerts = await import("../server/alerts");
  store = await import("../server/store");
});
beforeEach(async () => {
  await db.deliveryAttempt.deleteMany();
  await db.alert.deleteMany();
  await db.savedSearch.deleteMany();
  await db.setting.deleteMany();
  await db.lease.deleteMany();
  mocks.request.mockReset().mockResolvedValue({ status: 204, body: "" });
  mocks.sendMail
    .mockReset()
    .mockResolvedValue({ accepted: ["fixture@example.com"], rejected: [] });
  mocks.close.mockReset();
  mocks.createTransport
    .mockReset()
    .mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
  mocks.reserve.mockReset().mockResolvedValue(undefined);
  process.env.MUSCLESCOUT_WEBHOOK_URL = "https://example.com/fixture-webhook";
  process.env.MUSCLESCOUT_EMAIL_TO = "fixture@example.com";
  process.env.MUSCLESCOUT_SMTP_URL =
    "smtps://fixture:synthetic-secret@example.com";
});
afterAll(async () => {
  await db?.$disconnect();
  rmSync(folder, { recursive: true, force: true });
  delete process.env.MUSCLESCOUT_WEBHOOK_URL;
  delete process.env.MUSCLESCOUT_EMAIL_TO;
  delete process.env.MUSCLESCOUT_SMTP_URL;
});
async function pending(
  id: string,
  channel = "webhook",
  searchId = `fixture-search-${channel}`,
  kind = "new-match",
) {
  await db.savedSearch.upsert({
    where: { id: searchId },
    create: {
      id: searchId,
      name: "Offline consent fixture",
      filters: "{}",
      defaultsVersion: 1,
      schedule: "daily",
      delivery: channel,
    },
    update: {},
  });
  await db.alert.create({
    data: {
      id,
      searchId,
      listingId: "fixture-ad",
      kind,
      message: "Synthetic offline fixture update",
    },
  });
  await db.deliveryAttempt.create({
    data: {
      id: `${id}:${channel}`,
      alertId: id,
      channel,
      status: "pending",
      nextAttemptAt: new Date(0),
    },
  });
}
async function enable() {
  await db.setting.create({
    data: {
      key: "settings",
      value: JSON.stringify({ emailEnabled: true, webhookEnabled: true }),
    },
  });
}
describe("offline external-delivery lifecycle", () => {
  it.each(["off", "in-app", "deleted"])(
    "cancels queued delivery when its search is %s before sending",
    async (revocation) => {
      await enable();
      await pending("revoked");
      if (revocation === "deleted") await db.savedSearch.deleteMany();
      else
        await db.savedSearch.updateMany({
          data:
            revocation === "off" ? { schedule: "off" } : { delivery: "in-app" },
        });
      await alerts.deliverDigests();
      expect(mocks.request).not.toHaveBeenCalled();
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(
        await db.deliveryAttempt.findUnique({
          where: { id: "revoked:webhook" },
        }),
      ).toMatchObject({ status: "cancelled", attempts: 0 });
      await expect(
        alerts.retryDelivery("revoked:webhook", true),
      ).rejects.toMatchObject({ statusCode: 409 });
    },
  );
  it.each(["bid-change", "auction-deadline", "source-added"])(
    "cancels queued %s after that event opt-in is removed",
    async (kind) => {
      await enable();
      await pending("event-revoked", "webhook", "event-search", kind);
      await alerts.deliverDigests();
      expect(mocks.request).not.toHaveBeenCalled();
      expect(
        await db.deliveryAttempt.findUnique({
          where: { id: "event-revoked:webhook" },
        }),
      ).toMatchObject({ status: "cancelled", attempts: 0 });
    },
  );
  it("replaces a frozen failed digest with allowed members and preserves its original key and membership", async () => {
    await enable();
    await pending("allowed", "webhook", "allowed-search");
    await pending("revoked", "webhook", "revoked-search");
    mocks.request.mockResolvedValueOnce({ status: 503, body: "" });
    await alerts.deliverDigests();
    const original = JSON.parse(mocks.request.mock.calls[0][1].body);
    await db.savedSearch.update({
      where: { id: "revoked-search" },
      data: { delivery: "in-app" },
    });
    await db.deliveryAttempt.updateMany({
      data: { nextAttemptAt: new Date(0) },
    });
    await alerts.deliverDigests();
    const replacement = JSON.parse(mocks.request.mock.calls[1][1].body);
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.alerts.map((a: { id: string }) => a.id)).toEqual([
      "allowed",
    ]);
    const manifest = JSON.parse(
      (
        await db.setting.findUniqueOrThrow({
          where: { key: `delivery-batch:${original.id}` },
        })
      ).value,
    );
    expect(manifest).toMatchObject({
      id: original.id,
      attemptIds: ["allowed:webhook", "revoked:webhook"],
      replacementId: replacement.id,
    });
    expect(manifest.retiredAt).toBeTruthy();
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "allowed:webhook" } }),
    ).toMatchObject({ status: "delivered", attempts: 2 });
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "revoked:webhook" } }),
    ).toMatchObject({ status: "cancelled", attempts: 1 });
  });
  it("keeps allowed members of an uncertain split gated on acknowledgement and never resends revoked members", async () => {
    await enable();
    await pending("allowed", "webhook", "allowed-search");
    await pending("revoked", "webhook", "revoked-search");
    mocks.request.mockRejectedValueOnce(
      Object.assign(new Error("Timeout after send"), { code: "ETIMEDOUT" }),
    );
    await alerts.deliverDigests();
    const original = JSON.parse(mocks.request.mock.calls[0][1].body);
    await db.savedSearch.delete({ where: { id: "revoked-search" } });
    await alerts.deliverDigests();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "allowed:webhook" } }),
    ).toMatchObject({ status: "uncertain", attempts: 1 });
    await expect(alerts.retryDelivery("allowed:webhook")).rejects.toMatchObject(
      { statusCode: 409 },
    );
    await alerts.retryDelivery("allowed:webhook", true);
    await alerts.deliverDigests();
    const replacement = JSON.parse(mocks.request.mock.calls[1][1].body);
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.alerts.map((a: { id: string }) => a.id)).toEqual([
      "allowed",
    ]);
    expect(
      JSON.parse(
        (
          await db.setting.findUniqueOrThrow({
            where: { key: `delivery-batch:${original.id}` },
          })
        ).value,
      ).attemptIds,
    ).toEqual(["allowed:webhook", "revoked:webhook"]);
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "revoked:webhook" } }),
    ).toMatchObject({ status: "cancelled", attempts: 1 });
  });
  it.each(["search", "global"])(
    "rechecks %s consent after waiting for the shared destination budget",
    async (scope) => {
      await enable();
      await pending("waiting");
      mocks.reserve.mockImplementationOnce(async () => {
        if (scope === "search")
          await db.savedSearch.updateMany({ data: { schedule: "off" } });
        else
          await db.setting.update({
            where: { key: "settings" },
            data: { value: JSON.stringify({ webhookEnabled: false }) },
          });
      });
      await alerts.deliverDigests();
      expect(mocks.request).not.toHaveBeenCalled();
      expect(mocks.reserve).toHaveBeenCalledWith("https://example.com", {
        minIntervalMs: 1000,
        dailyLimit: 100,
        maxWaitMs: 10000,
      });
      expect(
        await db.deliveryAttempt.findUnique({
          where: { id: "waiting:webhook" },
        }),
      ).toMatchObject({
        status: scope === "search" ? "cancelled" : "blocked",
        attempts: 0,
      });
    },
  );
  it("defers exhausted request budgets without counting or attempting a send", async () => {
    await enable();
    await pending("budget");
    const { ServiceBudgetError } = await import("../server/service-budget"),
      retryAfterAt = new Date(Date.now() + 86400000).toISOString();
    mocks.reserve.mockRejectedValueOnce(
      new ServiceBudgetError("Budget reached", retryAfterAt),
    );
    await alerts.deliverDigests();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "budget:webhook" } }),
    ).toMatchObject({
      status: "retry",
      attempts: 0,
      nextAttemptAt: new Date(retryAfterAt),
    });
  });
  it.each(["webhook", "email"])(
    "blocks invalid %s configuration before reserving or attempting a send",
    async (channel) => {
      await enable();
      await pending("bad-config", channel);
      if (channel === "webhook")
        process.env.MUSCLESCOUT_WEBHOOK_URL = "invalid destination";
      else process.env.MUSCLESCOUT_SMTP_URL = "https://example.com";
      await alerts.deliverDigests();
      expect(mocks.reserve).not.toHaveBeenCalled();
      expect(mocks.request).not.toHaveBeenCalled();
      expect(mocks.sendMail).not.toHaveBeenCalled();
      expect(
        await db.deliveryAttempt.findUnique({
          where: { id: `bad-config:${channel}` },
        }),
      ).toMatchObject({ status: "blocked", attempts: 0 });
    },
  );
  it("rechecks later channel consent after an earlier digest finishes", async () => {
    await enable();
    await pending("first");
    await pending("later", "email");
    mocks.request.mockImplementationOnce(async () => {
      await db.savedSearch.update({
        where: { id: "fixture-search-email" },
        data: { delivery: "in-app" },
      });
      return { status: 204 };
    });
    await alerts.deliverDigests();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "later:email" } }),
    ).toMatchObject({ status: "cancelled", attempts: 0 });
  });
  it("sends nothing without opt-in and makes blocked configuration explicitly retryable", async () => {
    await pending("disabled");
    await alerts.deliverDigests();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(
      await db.deliveryAttempt.findUnique({
        where: { id: "disabled:webhook" },
      }),
    ).toMatchObject({ status: "blocked", attempts: 0 });
    await enable();
    await alerts.retryDelivery("disabled:webhook");
    await alerts.deliverDigests();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(
      await db.deliveryAttempt.findUnique({
        where: { id: "disabled:webhook" },
      }),
    ).toMatchObject({ status: "delivered", attempts: 1 });
  });
  it("freezes a webhook batch's key and membership while later alerts arrive", async () => {
    await enable();
    await pending("first");
    await pending("second");
    mocks.request.mockResolvedValueOnce({ status: 503, body: "" });
    await alerts.deliverDigests();
    const first = mocks.request.mock.calls[0][1],
      key = first.headers["Idempotency-Key"];
    await pending("third");
    await db.deliveryAttempt.updateMany({
      where: { status: "retry" },
      data: { nextAttemptAt: new Date(0) },
    });
    await alerts.deliverDigests();
    const repeat = mocks.request.mock.calls.find(
      (c, i) => i > 0 && c[1].headers["Idempotency-Key"] === key,
    );
    expect(repeat?.[1].body).toBe(first.body);
    expect(
      JSON.parse(first.body).alerts.map((a: { id: string }) => a.id),
    ).toEqual(["first", "second"]);
    expect(
      await db.deliveryAttempt.count({ where: { status: "delivered" } }),
    ).toBe(3);
  });
  it("marks interrupted sends uncertain and requires acknowledged manual retry", async () => {
    await enable();
    await pending("uncertain");
    mocks.request.mockRejectedValueOnce(
      Object.assign(new Error("Timed out after send"), { code: "ETIMEDOUT" }),
    );
    await alerts.deliverDigests();
    expect(
      await db.deliveryAttempt.findUnique({
        where: { id: "uncertain:webhook" },
      }),
    ).toMatchObject({ status: "uncertain" });
    await alerts.deliverDigests();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    await expect(
      alerts.retryDelivery("uncertain:webhook"),
    ).rejects.toMatchObject({ statusCode: 409 });
    await alerts.retryDelivery("uncertain:webhook", true);
    await alerts.deliverDigests();
    expect(mocks.request).toHaveBeenCalledTimes(2);
    expect(mocks.request.mock.calls[1][1].headers["Idempotency-Key"]).toBe(
      mocks.request.mock.calls[0][1].headers["Idempotency-Key"],
    );
  });
  it("recovers a process crash as uncertain and does not resend automatically", async () => {
    await enable();
    await pending("crash");
    await db.deliveryAttempt.updateMany({
      data: { status: "sending", attempts: 1 },
    });
    await alerts.deliverDigests();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "crash:webhook" } }),
    ).toMatchObject({ status: "uncertain" });
  });
  it("sets finite SMTP transport timeouts and reuses Message-ID on an acknowledged uncertain retry", async () => {
    await enable();
    await pending("mail", "email");
    mocks.sendMail.mockRejectedValueOnce(
      Object.assign(new Error("socket closed"), { code: "ECONNRESET" }),
    );
    await alerts.deliverDigests();
    expect(mocks.createTransport.mock.calls[0][0]).toMatchObject({
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      dnsTimeout: 10000,
    });
    expect(mocks.reserve).toHaveBeenCalledWith("smtp://example.com:465", {
      minIntervalMs: 1000,
      dailyLimit: 100,
      maxWaitMs: 10000,
    });
    const messageId = mocks.sendMail.mock.calls[0][0].messageId;
    await alerts.retryDelivery("mail:email", true);
    await alerts.deliverDigests();
    expect(mocks.sendMail.mock.calls[1][0].messageId).toBe(messageId);
    expect(mocks.close).toHaveBeenCalledTimes(2);
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "mail:email" } }),
    ).toMatchObject({ status: "delivered" });
  });
  it("dead-letters bounded retries and records the explicit reset audit", async () => {
    await enable();
    await pending("retry");
    await db.deliveryAttempt.updateMany({ data: { attempts: 5 } });
    mocks.request.mockResolvedValue({ status: 503, body: "" });
    await alerts.deliverDigests();
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "retry:webhook" } }),
    ).toMatchObject({ status: "failed", attempts: 6 });
    await alerts.retryDelivery("retry:webhook");
    expect(
      await db.setting.count({
        where: { key: { startsWith: "delivery-retry:" } },
      }),
    ).toBe(1);
    expect(
      await db.deliveryAttempt.findUnique({ where: { id: "retry:webhook" } }),
    ).toMatchObject({ status: "retry", attempts: 0 });
  });
  it("serializes delivery and manual retry against a worker's lease", async () => {
    await pending("leased");
    const lease = await store.acquireLease("alert-delivery", 120);
    expect(await alerts.deliverDigests()).toMatchObject({ busy: true });
    await expect(alerts.retryDelivery("leased:webhook")).rejects.toMatchObject({
      statusCode: 409,
    });
    await lease!.release();
  });
});
