import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  deliveryBatchId,
  deliveryFailure,
  smtpTransportOptions,
} from "../server/delivery-policy";
import { writePrivateValidation } from "./verification-report";
type Channel = "webhook" | "email";
type Env = Record<string, string | undefined>;
type Receipt = {
  id: string;
  channel: Channel;
  createdAt: string;
  status: string;
  attempts: number;
  nextAttemptAt?: string;
  error?: string | null;
};
type Runtime = {
  getSettings: () => Promise<{
    webhookEnabled: boolean;
    emailEnabled: boolean;
  }>;
  acquireLease: typeof import("../server/store").acquireLease;
  reserve: typeof import("../server/service-budget").reserveServiceRequest;
  request: typeof import("../server/safe-fetch").safeRequest;
  readReceipt: (id: string) => Promise<Receipt | null>;
  writeReceipt: (receipt: Receipt) => Promise<void>;
  sendEmail: (
    env: Env,
    destination: string,
    id: string,
    text: string,
  ) => Promise<void>;
  disconnect: () => Promise<void>;
};
async function loadRuntime(): Promise<Runtime> {
  const [
    { getSettings, acquireLease },
    { reserveServiceRequest },
    { safeRequest },
    { db },
  ] = await Promise.all([
    import("../server/store"),
    import("../server/service-budget"),
    import("../server/safe-fetch"),
    import("../server/db"),
  ]);
  return {
    getSettings,
    acquireLease,
    reserve: reserveServiceRequest,
    request: safeRequest,
    async readReceipt(id) {
      const row = await db.setting.findUnique({
        where: { key: `delivery-acceptance:${id}` },
      });
      return row ? JSON.parse(row.value) : null;
    },
    async writeReceipt(receipt) {
      const key = `delivery-acceptance:${receipt.id}`,
        value = JSON.stringify(receipt);
      await db.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    },
    async sendEmail(env, destination, id, text) {
      const { default: nodemailer } = await import("nodemailer");
      const transport = nodemailer.createTransport(
        smtpTransportOptions(env.MUSCLESCOUT_SMTP_URL!),
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          transport.sendMail({
            from: env.MUSCLESCOUT_EMAIL_FROM || destination,
            to: destination,
            subject: "MuscleScout · synthetic delivery validation",
            text,
            messageId: `<${id}@musclescout.local>`,
            headers: { "X-MuscleScout-Digest-ID": id },
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              transport.close();
              reject(
                Object.assign(new Error("SMTP deadline elapsed."), {
                  uncertain: true,
                }),
              );
            }, 30000);
          }),
        ]);
        if (result.rejected?.length || result.accepted?.length !== 1)
          throw Object.assign(
            new Error(
              "SMTP did not confirm exactly one accepted recipient; partial delivery is possible.",
            ),
            { uncertain: true },
          );
      } finally {
        if (timer) clearTimeout(timer);
        transport.close();
      }
    },
    disconnect: () => db.$disconnect(),
  };
}
export function deliveryReadiness(
  env: Env,
  channel: string | undefined,
  settings?: { webhookEnabled: boolean; emailEnabled: boolean },
) {
  if (channel !== "email" && channel !== "webhook")
    return {
      status: "blocked",
      reason:
        "Choose exactly one channel with --channel=email or --channel=webhook.",
      sendOperations: 0,
    };
  const destination =
    channel === "webhook"
      ? env.MUSCLESCOUT_WEBHOOK_URL
      : env.MUSCLESCOUT_EMAIL_TO;
  if (
    !destination?.trim() ||
    (channel === "email" && !env.MUSCLESCOUT_SMTP_URL?.trim())
  )
    return {
      status: "blocked",
      reason:
        "The chosen destination or SMTP transport is not configured. No message was sent.",
      channel,
      sendOperations: 0,
    };
  if (channel === "webhook") {
    try {
      const url = new URL(destination);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (url.port && url.port !== "443")
      )
        throw new Error();
    } catch {
      return {
        status: "blocked",
        reason:
          "The webhook must be an HTTPS URL without embedded credentials and use the default HTTPS port.",
        channel,
        sendOperations: 0,
      };
    }
  } else {
    if (!/^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(destination))
      return {
        status: "blocked",
        reason:
          "The synthetic email check requires exactly one plain recipient address.",
        channel,
        sendOperations: 0,
      };
    try {
      smtpTransportOptions(env.MUSCLESCOUT_SMTP_URL!);
    } catch {
      return {
        status: "blocked",
        reason: "SMTP transport URL is invalid. No message was sent.",
        channel,
        sendOperations: 0,
      };
    }
  }
  if (
    settings &&
    !(channel === "webhook" ? settings.webhookEnabled : settings.emailEnabled)
  )
    return {
      status: "blocked",
      reason:
        "This delivery channel is not opted in through application settings. No message was sent.",
      channel,
      sendOperations: 0,
    };
  return {
    status: settings ? "ready" : "configuration-present",
    reason:
      "Transport configuration is present; --send-test and the enabled channel setting are both required to send one synthetic digest.",
    channel,
    sendOperations: 0,
  };
}
export function acceptanceDigestId(
  channel: Channel,
  destination: string,
  testId = "connectivity-v1",
) {
  return deliveryBatchId(channel, [
    `synthetic-acceptance:${testId}`,
    createHash("sha256").update(destination).digest("hex"),
  ]);
}
export async function verifyDelivery(
  options: {
    channel?: string;
    sendTest?: boolean;
    retryTest?: boolean;
    acknowledgeUncertain?: boolean;
    testId?: string;
    env?: Env;
  } = {},
  load: () => Promise<Runtime> = loadRuntime,
): Promise<Record<string, unknown>> {
  const env = options.env || process.env,
    preliminary = deliveryReadiness(env, options.channel);
  if (preliminary.status === "blocked") return preliminary;
  if (options.testId && !/^[a-zA-Z0-9_-]{1,64}$/.test(options.testId))
    return {
      status: "blocked",
      reason:
        "Test ID must contain only 1–64 letters, digits, underscores or hyphens.",
      sendOperations: 0,
    };
  let runtime: Runtime;
  try {
    runtime = await load();
  } catch {
    return {
      status: "blocked",
      reason:
        "Local runtime initialization failed before sending. Check setup and database configuration.",
      sendOperations: 0,
    };
  }
  let lease: Awaited<ReturnType<Runtime["acquireLease"]>> = null;
  const channel = options.channel as Channel,
    destination = (
      channel === "webhook"
        ? env.MUSCLESCOUT_WEBHOOK_URL
        : env.MUSCLESCOUT_EMAIL_TO
    )!;
  const id = acceptanceDigestId(channel, destination, options.testId),
    service =
      channel === "webhook"
        ? new URL(destination).origin
        : `smtp://${smtpTransportOptions(env.MUSCLESCOUT_SMTP_URL!).host}:${smtpTransportOptions(env.MUSCLESCOUT_SMTP_URL!).port}`;
  let sendOperations = 0;
  try {
    const readiness = deliveryReadiness(
      env,
      channel,
      await runtime.getSettings(),
    );
    if (readiness.status === "blocked" || !options.sendTest)
      return { ...readiness, id, mode: "check-only", queuedAlertsRead: 0 };
    lease = await runtime.acquireLease("alert-delivery", 120);
    if (!lease)
      return {
        status: "blocked",
        reason:
          "Another sender holds the delivery lease. No synthetic digest was sent.",
        id,
        sendOperations: 0,
      };
    let previous = await runtime.readReceipt(id);
    if (previous?.status === "sending") {
      previous = {
        ...previous,
        status: "uncertain",
        error:
          "A prior process stopped before recording its receipt; the destination may have accepted the test.",
      };
      await runtime.writeReceipt(previous);
    }
    if (previous?.status === "delivered")
      return {
        status: "already-accepted-by-transport",
        reason:
          "This stable test ID already has a successful transport receipt; no duplicate test was sent.",
        id,
        sendOperations: 0,
      };
    if (previous && !options.retryTest)
      return {
        status: "blocked",
        reason:
          "This test already has an attempt. Review its receipt and use --retry-test to explicitly retry the same digest ID.",
        id,
        previousStatus: previous.status,
        sendOperations: 0,
      };
    if (previous?.status === "uncertain" && !options.acknowledgeUncertain)
      return {
        status: "blocked",
        reason:
          "The earlier test may have arrived. Review the destination and use --acknowledge-uncertain with --retry-test before risking a duplicate.",
        id,
        sendOperations: 0,
      };
    if (
      previous?.nextAttemptAt &&
      Date.parse(previous.nextAttemptAt) > Date.now()
    )
      return {
        status: "blocked",
        reason: "The previous bounded retry interval has not elapsed.",
        id,
        retryAfterAt: previous.nextAttemptAt,
        sendOperations: 0,
      };
    // Uses the same persistent reservation implementation as source/service jobs.
    await runtime.reserve(service, {
      minIntervalMs: 1000,
      dailyLimit: 100,
      maxWaitMs: 10000,
    });
    await lease.renew();
    const currentConsent = deliveryReadiness(
      env,
      channel,
      await runtime.getSettings(),
    );
    if (currentConsent.status === "blocked")
      return {
        ...currentConsent,
        id,
        reason:
          "Channel consent was revoked before this synthetic attempt. No message was sent.",
      };
    const receipt: Receipt = {
      id,
      channel,
      createdAt: previous?.createdAt || new Date().toISOString(),
      status: "sending",
      attempts: (previous?.attempts || 0) + 1,
    };
    const message =
      "MuscleScout delivery validation. This is one synthetic test digest; it contains no inventory, saved-search matches, personal notes or queued alerts.";
    await runtime.writeReceipt(receipt);
    let transportAccepted = false;
    try {
      sendOperations++;
      if (channel === "webhook") {
        const result = await runtime.request(destination, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": id,
          },
          body: JSON.stringify({
            application: "MuscleScout",
            kind: "digest",
            synthetic: true,
            id,
            alerts: [
              {
                id: `${id}:synthetic`,
                kind: "test-digest",
                message,
                createdAt: receipt.createdAt,
              },
            ],
          }),
          maxBytes: 500000,
        });
        if (result.status < 200 || result.status >= 300)
          throw Object.assign(new Error("Webhook rejected synthetic digest."), {
            statusCode: result.status,
          });
      } else
        await runtime.sendEmail(
          env,
          destination,
          id,
          `${message}\n\nDigest ID: ${id}`,
        );
      transportAccepted = true;
      await runtime.writeReceipt({
        ...receipt,
        status: "delivered",
        error: null,
      });
      return {
        status: "accepted-by-transport",
        channel,
        id,
        sendOperations,
        queuedAlertsRead: 0,
        automaticRetriesScheduled: 0,
        remainingAcceptance:
          "Verify exactly one receipt at the configured destination using this digest ID; transport acceptance alone does not prove inbox/application processing.",
      };
    } catch (error) {
      // Losing persistence after a transport accepted the message must never be
      // classified as an ordinary retry: the recipient may already have it.
      const failure = deliveryFailure(
        transportAccepted ? { uncertain: true } : error,
        receipt.attempts,
      );
      const description = failure.error.replace(
        "a bounded retry is scheduled.",
        "no retry was scheduled by this validation script.",
      );
      let receiptRecorded = true;
      try {
        await runtime.writeReceipt({
          ...receipt,
          status: failure.status,
          error: description,
          nextAttemptAt: failure.nextAttemptAt.toISOString(),
        });
      } catch {
        receiptRecorded = false;
      }
      return {
        status: receiptRecorded ? failure.status : "uncertain",
        reason: receiptRecorded
          ? description
          : "The synthetic attempt could not be recorded. Review the destination before any explicit retry; receipt persistence is unavailable.",
        channel,
        id,
        sendOperations,
        queuedAlertsRead: 0,
        receiptRecorded,
        automaticRetriesScheduled: 0,
        retryAfterAt: failure.nextAttemptAt.toISOString(),
      };
    }
  } catch (error) {
    const failure = deliveryFailure(error, 1);
    return {
      status: sendOperations ? "uncertain" : "blocked",
      reason: sendOperations
        ? failure.error
        : "A lease, shared service budget or local persistence prerequisite failed before sending. No message was attempted.",
      channel,
      id,
      sendOperations,
      automaticRetriesScheduled: 0,
    };
  } finally {
    await Promise.allSettled([lease?.release(), runtime.disconnect()]);
  }
}
if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  await import("dotenv/config");
  const value = (name: string) =>
    process.argv
      .find((item) => item.startsWith(`--${name}=`))
      ?.slice(name.length + 3);
  const report = await verifyDelivery({
    channel: value("channel"),
    testId: value("test-id"),
    sendTest: process.argv.includes("--send-test"),
    retryTest: process.argv.includes("--retry-test"),
    acknowledgeUncertain: process.argv.includes("--acknowledge-uncertain"),
  });
  const reportPath = await writePrivateValidation("delivery", report);
  console.log(
    JSON.stringify(
      {
        status: report.status,
        reason: report.reason,
        id: report.id,
        sendOperations: report.sendOperations,
        reportPath,
      },
      null,
      2,
    ),
  );
}
