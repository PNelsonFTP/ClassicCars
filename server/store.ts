import { createHash, randomUUID } from "node:crypto";
import { db } from "./db";
import {
  listingSchema,
  settingsSchema,
  emptyWorkspace,
  type Listing,
  type Settings,
  type Workspace,
  type Snapshot,
  type Coverage,
} from "../shared/schema";
import {
  feedAllowsPublicExport,
  feedAllowsPublicImages,
} from "./ingest/authorized-feed";
import { catalogSnapshot, packCatalog } from "../shared/catalog";
import {
  applyOverrides,
  sourceRecord,
  retainedReviewEvidence,
} from "../shared/reviews";
import { projectFreshness } from "../shared/freshness";
import {
  mayAutoGroup,
  pairId,
  identifierConflicts,
} from "../shared/duplicates";
import { blockedAutomaticPairs } from "./grouping";
import { strongGroupKey } from "../shared/search";
import { readFile, writeFile, mkdir, readdir, unlink } from "node:fs/promises";
import { mergeVehicleGeography } from "../shared/location-merge";
import { redactPublicListing } from "./public-redaction";
export async function getSettings(): Promise<Settings> {
  const row = await db.setting.findUnique({ where: { key: "settings" } });
  return settingsSchema.parse(row ? JSON.parse(row.value) : {});
}
export async function saveSettings(settings: Settings) {
  const old = await getSettings();
  await db.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "settings" },
      create: { key: "settings", value: JSON.stringify(settings) },
      update: { value: JSON.stringify(settings) },
    });
    if (JSON.stringify(old.home) !== JSON.stringify(settings.home)) {
      for (const row of await tx.listing.findMany()) {
        const listing = listingSchema.parse(JSON.parse(row.payload));
        listing.route = null;
        listing.straightLineMiles = null;
        await tx.listing.update({
          where: { id: row.id },
          data: { driveMinutes: null, payload: JSON.stringify(listing) },
        });
      }
    }
  });
}
export async function allListings(): Promise<Listing[]> {
  const settings = await getSettings();
  return (await db.listing.findMany()).map((row) => {
    const l = listingSchema.parse(JSON.parse(row.payload));
    return projectFreshness(
      l,
      settings.staleDays,
      Date.now(),
      settings.auctionMaxAgeHours,
    );
  });
}
export async function getWorkspace() {
  const row = await db.workspace.findUnique({ where: { id: "personal" } });
  return {
    workspace: row ? (JSON.parse(row.payload) as Workspace) : emptyWorkspace(),
    revision: row?.revision ?? 0,
  };
}
export function mergeObservation(
  old: Listing | undefined,
  incoming: Listing,
): Listing {
  // A projected/user-reviewed row is not evidence of its pre-review source values.
  const incomingSource =
    incoming.sourceRecord ||
    (!incoming.userOverrides ? sourceRecord(incoming) : old?.sourceRecord);
  if (!old)
    return applyOverrides({ ...incoming, sourceRecord: incomingSource });
  if (Date.parse(incoming.lastObservedAt) < Date.parse(old.lastObservedAt))
    return {
      ...incoming,
      ...old,
      specs: { ...incoming.specs, ...old.specs },
      photos: old.photos.length ? old.photos : incoming.photos,
    };
  const richer =
    Object.keys(incoming.specs).length >= Object.keys(old.specs).length;
  const detail = incoming.parserVersion.includes("detail");
  const geography = mergeVehicleGeography(old, incoming, detail);
  const preserveDetails =
    !detail &&
    !!(old.lastDetailObservedAt || old.parserVersion.includes("detail"));
  return applyOverrides({
    ...old,
    ...incoming,
    firstSeenAt: old.firstSeenAt,
    lastObservedAt:
      Date.parse(incoming.lastObservedAt) > Date.parse(old.lastObservedAt)
        ? incoming.lastObservedAt
        : old.lastObservedAt,
    description: preserveDetails
      ? old.description
      : incoming.description || old.description,
    askingPrice:
      preserveDetails &&
      incoming.askingPrice == null &&
      !incoming.priceOnRequest
        ? old.askingPrice
        : incoming.askingPrice,
    fieldEvidence: {
      ...old.fieldEvidence,
      ...incoming.fieldEvidence,
      ...retainedReviewEvidence(old, incoming),
      ...(preserveDetails &&
      incoming.askingPrice == null &&
      !incoming.priceOnRequest &&
      old.fieldEvidence.askingPrice
        ? { askingPrice: old.fieldEvidence.askingPrice }
        : {}),
    },
    lastDetailAttemptAt:
      incoming.lastDetailAttemptAt || old.lastDetailAttemptAt,
    lastDetailObservedAt:
      incoming.lastDetailObservedAt || old.lastDetailObservedAt,
    originalSellerText: preserveDetails
      ? old.originalSellerText
      : incoming.originalSellerText || old.originalSellerText,
    specs: { ...old.specs, ...incoming.specs },
    photos: incoming.photos.length ? incoming.photos : old.photos,
    identifier: incoming.identifier || old.identifier,
    stockNumber: incoming.stockNumber || old.stockNumber,
    availability:
      preserveDetails && incoming.availability === "unknown"
        ? old.availability
        : incoming.availability,
    sourceAvailability:
      preserveDetails &&
      (incoming.sourceAvailability || incoming.availability) === "unknown"
        ? old.sourceAvailability || old.availability
        : incoming.sourceAvailability || incoming.availability,
    sourceRecord: incomingSource
      ? {
          ...incomingSource,
          vehicleLocation: detail
            ? incomingSource.vehicleLocation
            : incomingSource.vehicleLocation ||
              old.sourceRecord?.vehicleLocation ||
              null,
          fieldEvidence: {
            ...old.sourceRecord?.fieldEvidence,
            ...incomingSource.fieldEvidence,
          },
        }
      : undefined,
    ...geography,
    groupId: old.groupId || incoming.groupId,
    parserVersion: richer ? incoming.parserVersion : old.parserVersion,
    flags: [...new Set([...old.flags, ...incoming.flags])],
    userOverrides: incoming.userOverrides || old.userOverrides,
  });
}
export async function upsertListing(input: unknown) {
  const candidate = listingSchema.parse(input);
  for (const key of [
    "year",
    "model",
    "askingPrice",
    "currentBid",
    "availability",
    "saleType",
    "specialty",
    "specialtyEvidence",
  ] as const) {
    if (candidate[key] != null && !candidate.fieldEvidence[key])
      candidate.fieldEvidence[key] = {
        value: candidate[key],
        basis: "seller-claimed",
        sourceUrl: candidate.url,
        observedAt: candidate.lastObservedAt,
      };
  }
  if (candidate.isSample)
    throw new Error("Sample data cannot enter the real inventory database.");
  const existing = await db.listing.findUnique({ where: { id: candidate.id } });
  const old = existing
    ? listingSchema.parse(JSON.parse(existing.payload))
    : undefined;
  if (!candidate.sourceAvailability)
    candidate.sourceAvailability = candidate.availability;
  const listing = mergeObservation(old, candidate);
  if (listing.groupId?.startsWith("vehicle:")) {
    const peers = await db.listing.findMany({
      where: { groupId: listing.groupId, id: { not: listing.id } },
    });
    if (
      peers.some(
        (p) =>
          identifierConflicts(
            listing,
            listingSchema.parse(JSON.parse(p.payload)),
          ).length,
      )
    ) {
      listing.groupId = null;
      listing.identityStatus = "review";
      listing.identityNotes.push(
        "Source identifiers now conflict with the automatic group; review the documents.",
      );
    }
  }
  const key = strongGroupKey(listing);
  if (!listing.groupId && key) {
    const others = await db.listing.findMany({
      where: { model: listing.model, year: listing.year },
    });
    const blocked = await blockedAutomaticPairs();
    const peer = others
      .map((r) => listingSchema.parse(JSON.parse(r.payload)))
      .find(
        (l) =>
          l.id !== listing.id &&
          strongGroupKey(l) === key &&
          mayAutoGroup(listing, l) &&
          !blocked.has(pairId(listing.id, l.id)),
      );
    if (peer) {
      listing.groupId =
        peer.groupId ||
        `vehicle:${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
      await db.listing.update({
        where: { id: peer.id },
        data: {
          groupId: listing.groupId,
          payload: JSON.stringify({ ...peer, groupId: listing.groupId }),
        },
      });
    }
  }
  const record = {
    sourceId: listing.sourceId,
    sourceListingId: listing.sourceListingId,
    model: listing.model,
    year: listing.year,
    askingPrice: listing.askingPrice,
    availability: listing.availability,
    saleType: listing.saleType,
    vehicleState: listing.vehicleLocation?.state,
    driveMinutes: listing.route?.minutes,
    groupId: listing.groupId,
    firstSeenAt: new Date(listing.firstSeenAt),
    lastObservedAt: new Date(listing.lastObservedAt),
    payload: JSON.stringify(listing),
  };
  await db.$transaction(async (tx) => {
    await tx.listing.upsert({
      where: { id: listing.id },
      create: { id: listing.id, ...record },
      update: record,
    });
    const observations: [string, number | null, boolean][] = [
      ["source", null, true],
      [
        "ask",
        listing.askingPrice,
        listing.askingPrice != null &&
          listing.saleType !== "auction" &&
          (!old || old.askingPrice !== listing.askingPrice),
      ],
      [
        "bid",
        listing.currentBid,
        listing.currentBid != null &&
          (!old || old.currentBid !== listing.currentBid),
      ],
      ["availability", null, !old || old.availability !== listing.availability],
    ];
    for (const [kind, amount, needed] of observations)
      if (needed) {
        await tx.observation.upsert({
          where: {
            listingId_kind_observedAt: {
              listingId: listing.id,
              kind,
              observedAt: new Date(candidate.lastObservedAt),
            },
          },
          create: {
            listingId: listing.id,
            kind,
            amount,
            observedAt: new Date(candidate.lastObservedAt),
            evidenceRef: candidate.evidenceRef,
            payload: JSON.stringify(
              kind === "source"
                ? candidate
                : {
                    availability: listing.availability,
                    parser: listing.parserVersion,
                    sourceUrl: listing.url,
                    networkCheckedAt: listing.lastNetworkCheckedAt,
                  },
            ),
          },
          update: {},
        });
      }
  });
  return listing;
}
export async function acquireLease(name: string, seconds = 120) {
  const owner = randomUUID(),
    now = new Date();
  const expiresAt = new Date(now.getTime() + seconds * 1000);
  const claimed = await db.lease.updateMany({
    where: { name, expiresAt: { lt: now } },
    data: { owner, expiresAt },
  });
  if (!claimed.count) {
    try {
      await db.lease.create({ data: { name, owner, expiresAt } });
    } catch {
      return null;
    }
  }
  return {
    owner,
    renew: async () => {
      const r = await db.lease.updateMany({
        where: { name, owner },
        data: { expiresAt: new Date(Date.now() + seconds * 1000) },
      });
      if (!r.count) throw new Error("Collection lease lost; stop work.");
    },
    release: () => db.lease.deleteMany({ where: { name, owner } }),
  };
}
export async function snapshot(redact = true): Promise<Snapshot> {
  const listings = await allListings(),
    settings = await getSettings();
  const coverage: Coverage[] = JSON.parse(
    await readFile("config/sources.json", "utf8"),
  );
  const runs = await db.ingestRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 60,
  });
  for (const c of coverage) {
    if (redact && settings.snapshotExcludeSources.includes(c.id))
      c.note +=
        " Omitted from the public snapshot by export settings; original observations remain in the local database.";
    const ads = listings.filter((l) => l.sourceId === c.id);
    c.count = ads.length || undefined;
    c.lastObservedAt = ads.sort((a, b) =>
      b.lastObservedAt.localeCompare(a.lastObservedAt),
    )[0]?.lastObservedAt;
    const run = runs.find((r) => r.sourceId === c.id);
    if (run) {
      c.status = run.status;
      c.note += ` Last run: ${run.error || JSON.parse(run.stats).note || run.status}.`;
    }
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    freshnessPolicy: {
      staleDays: settings.staleDays,
      auctionMaxAgeHours: settings.auctionMaxAgeHours,
    },
    collectionCounts: {
      rawAds: listings.length,
      groups: new Set(listings.map((l) => l.groupId || l.id)).size,
      publicAds: listings.filter(
        (l) =>
          !settings.snapshotExcludeSources.includes(l.sourceId) &&
          feedAllowsPublicExport(l),
      ).length,
    },
    listings: listings
      .filter(
        (l) =>
          !redact ||
          (!settings.snapshotExcludeSources.includes(l.sourceId) &&
            feedAllowsPublicExport(l)),
      )
      .map((l) => {
        const stale =
          Date.now() - Date.parse(l.lastObservedAt) >
          settings.staleDays * 864e5;
        return {
          ...l,
          availability:
            stale && ["active", "unknown"].includes(l.availability)
              ? "stale"
              : l.availability,
          ...(redact ? redactPublicListing(l) : {}),
        };
      }),
    coverage,
    runs: runs.map((r) => ({
      ...r,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString(),
      stats: JSON.parse(r.stats),
    })),
    limitations: [
      "This is observed inventory, not a complete census of the market. Ads may change after observation.",
      "Strict four-hour eligibility requires a fresh routed estimate to an established vehicle location. No routing credential was provided for the initial collection.",
      "Source details, location claims and specialty claims may need review. Cached reads retain their original observation time.",
      "Photos remain hosted by their original source and may be unavailable. Private evidence and workspace data are not in this snapshot.",
      "Nationwide collection uses broader jobs; removing a travel filter does not establish complete national coverage.",
    ],
  };
}
export async function exportSnapshot(outputDirectory = "public/data") {
  await mkdir(outputDirectory, { recursive: true });
  const result = await snapshot(true);
  await writeFile(`${outputDirectory}/snapshot.json`, JSON.stringify(result));
  const detailFiles: Record<string, string> = {};
  await mkdir(`${outputDirectory}/details`, { recursive: true });
  for (let offset = 0; offset < result.listings.length; offset += 100) {
    const rows = result.listings.slice(offset, offset + 100),
      body = JSON.stringify(rows);
    const filename = `details/${createHash("sha256").update(body).digest("hex").slice(0, 24)}.json`;
    await writeFile(`${outputDirectory}/${filename}`, body);
    for (const l of rows) detailFiles[l.id] = filename;
  }
  await writeFile(
    `${outputDirectory}/catalog.json`,
    JSON.stringify(packCatalog(catalogSnapshot(result, detailFiles))),
  );
  const currentFiles = new Set(
    Object.values(detailFiles).map((file) => file.slice("details/".length)),
  );
  for (const name of await readdir(`${outputDirectory}/details`)) {
    if (/^[a-f0-9]{24}\.json$/.test(name) && !currentFiles.has(name))
      await unlink(`${outputDirectory}/details/${name}`);
  }

  return {
    ads: result.listings.length,
    groups: new Set(result.listings.map((l) => l.groupId || l.id)).size,
    generatedAt: result.generatedAt,
  };
}
