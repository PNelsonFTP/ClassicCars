import { type Listing, sourceRecordSchema } from "./schema";
import { generation, identify } from "./search";

export function sourceRecord(listing: Listing) {
  return sourceRecordSchema.parse(listing);
}
export function applyOverrides(listing: Listing): Listing {
  const overrides = listing.userOverrides;
  if (!overrides) return listing;
  const result = { ...listing, fieldEvidence: { ...listing.fieldEvidence } };
  for (const key of [
    "year",
    "identityStatus",
    "specialtyEvidence",
    "vehicleLocation",
  ] as const) {
    if (Object.hasOwn(overrides, key))
      Object.assign(result, { [key]: overrides[key] });
  }
  if (Object.hasOwn(overrides, "year")) {
    const identity = identify(`${result.year ?? ""} ${result.model ?? ""}`);
    result.generation = generation(result);
    result.identityStatus = identity.identityStatus;
    result.identityNotes = identity.identityNotes;
  }
  for (const key of ["year", "specialtyEvidence"] as const) {
    if (
      Object.hasOwn(overrides, key) &&
      !(
        result.fieldEvidence[key]?.basis === "user-reviewed" &&
        result.fieldEvidence[key]?.value === result[key]
      )
    )
      result.fieldEvidence[key] = {
        value: result[key],
        basis: "user-reviewed",
        observedAt: overrides.reviewedAt,
        note: overrides.reason,
      };
  }
  return result;
}
/** A source refresh must not replace the date/reason of an unchanged user correction. */
export function retainedReviewEvidence(
  old: Listing,
  incoming: Listing,
): Listing["fieldEvidence"] {
  const overrides = incoming.userOverrides || old.userOverrides,
    evidence: Listing["fieldEvidence"] = {};
  for (const key of ["year", "specialtyEvidence"] as const)
    if (
      overrides &&
      Object.hasOwn(overrides, key) &&
      old.fieldEvidence[key]?.basis === "user-reviewed" &&
      old.fieldEvidence[key]?.value === overrides[key]
    )
      evidence[key] = old.fieldEvidence[key];
  return evidence;
}
