import { z } from "zod";
import { db } from "./db";
import { listingSchema, locationSchema, type Listing } from "../shared/schema";
import { applyOverrides, sourceRecord } from "../shared/reviews";
import { generation } from "../shared/search";
export const reviewPatchSchema = z
  .object({
    year: z.number().int().min(1885).max(2100).nullable().optional(),
    specialtyEvidence: z
      .enum([
        "unknown",
        "seller-claimed",
        "document-supported",
        "user-reviewed",
      ])
      .optional(),
    vehicleLocation: locationSchema.nullable().optional(),
    reason: z.string().trim().min(5).max(5000),
  })
  .refine(
    (p) =>
      ["year", "specialtyEvidence", "vehicleLocation"].some((k) =>
        Object.hasOwn(p, k),
      ),
    "Choose a field to correct",
  );
export async function correctListing(id: string, input: unknown) {
  const patch = reviewPatchSchema.parse(input);
  return db.$transaction(async (tx) => {
    const row = await tx.listing.findUniqueOrThrow({ where: { id } });
    const old = listingSchema.parse(JSON.parse(row.payload));
    const baseline =
      old.sourceRecord || (!old.userOverrides ? sourceRecord(old) : undefined);
    const { reason, ...fields } = patch;
    const reviewedAt = new Date().toISOString(),
      fieldEvidence = { ...old.fieldEvidence };
    for (const key of ["year", "specialtyEvidence"] as const)
      if (Object.hasOwn(fields, key))
        fieldEvidence[key] = {
          value: fields[key] ?? null,
          basis: "user-reviewed",
          observedAt: reviewedAt,
          note: reason,
        };
    const updated = applyOverrides({
      ...old,
      fieldEvidence,
      sourceRecord: baseline,
      userOverrides: {
        ...old.userOverrides,
        ...fields,
        reason,
        reviewedAt,
      },
    });
    if (Object.hasOwn(patch, "vehicleLocation")) {
      updated.route = null;
      updated.straightLineMiles = null;
      updated.routeUnknownReason =
        "Reviewed vehicle location changed; driving route must be refreshed.";
    }
    await write(tx, updated);
    await tx.observation.create({
      data: {
        listingId: id,
        kind: "user-correction",
        observedAt: new Date(),
        payload: JSON.stringify({
          previous: sourceRecord(old),
          patch,
          current: sourceRecord(updated),
          source: baseline,
        }),
      },
    });
    return updated;
  });
}
export async function resetCorrection(id: string, reason: string) {
  z.string().trim().min(5).max(5000).parse(reason);
  return db.$transaction(async (tx) => {
    const row = await tx.listing.findUniqueOrThrow({ where: { id } });
    const old = listingSchema.parse(JSON.parse(row.payload));
    if (!old.userOverrides) return old;
    if (!old.sourceRecord)
      throw Object.assign(
        new Error(
          "No safe source baseline exists for this legacy correction. Refresh permitted source evidence before resetting.",
        ),
        { statusCode: 409 },
      );
    const updated: Listing = {
      ...old,
      ...old.sourceRecord,
      userOverrides: undefined,
      route: null,
      straightLineMiles: null,
      routeUnknownReason:
        "Source location restored; driving route must be refreshed.",
    };
    updated.generation = generation(updated);
    await write(tx, updated);
    await tx.observation.create({
      data: {
        listingId: id,
        kind: "correction-reset",
        observedAt: new Date(),
        payload: JSON.stringify({
          reason,
          previous: sourceRecord(old),
          current: sourceRecord(updated),
          removedOverride: old.userOverrides,
        }),
      },
    });
    return updated;
  });
}
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];
async function write(tx: Tx, l: Listing) {
  await tx.listing.update({
    where: { id: l.id },
    data: {
      year: l.year,
      vehicleState: l.vehicleLocation?.state ?? null,
      driveMinutes: l.route?.minutes ?? null,
      payload: JSON.stringify(l),
    },
  });
}
export async function provenance(id: string, offset = 0, limit = 25) {
  const row = await db.listing.findUniqueOrThrow({ where: { id } });
  const listing = listingSchema.parse(JSON.parse(row.payload));
  const where = {
    listingId: id,
    kind: {
      in: ["source", "user-correction", "correction-reset", "geocode-retry"],
    },
  };
  const total = await db.observation.count({ where });
  const events = await db.observation.findMany({
    where,
    orderBy: [{ observedAt: "desc" }, { id: "desc" }],
    skip: offset,
    take: limit,
  });
  return {
    current: sourceRecord(listing),
    source: listing.sourceRecord,
    override: listing.userOverrides,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      observedAt: e.observedAt.toISOString(),
      evidence: JSON.parse(e.payload),
    })),
    total,
    nextOffset: offset + events.length < total ? offset + events.length : null,
  };
}
