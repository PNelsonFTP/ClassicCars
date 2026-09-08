import type { Listing } from "../shared/schema";
import { feedAllowsPublicImages } from "./ingest/authorized-feed";
const cleanText = (value: string) =>
  value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[contact redacted]")
    .replace(
      /(?:\+?1[ -]?)?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}/g,
      "[phone redacted]",
    );
const privateKey = (key: string) =>
  key.toLowerCase().startsWith("feed.") ||
  /(?:^|[._])(?:vin|identifier|cowltag|sellercontact|email|phone)(?:$|[._])/i.test(
    key,
  );
function publicEvidence(record: Listing["fieldEvidence"]) {
  return Object.fromEntries(
    Object.entries(record)
      .filter(([key]) => !privateKey(key))
      .map(([key, evidence]) => [
        key,
        {
          ...evidence,
          value:
            typeof evidence.value === "string"
              ? cleanText(evidence.value)
              : evidence.value,
          note:
            evidence.basis === "user-reviewed"
              ? undefined
              : evidence.note
                ? cleanText(evidence.note)
                : undefined,
        },
      ]),
  );
}
export function redactPublicListing(l: Listing): Listing {
  return {
    ...l,
    identifier: null,
    photos: feedAllowsPublicImages(l) ? l.photos : [],
    userOverrides: undefined,
    sourceRecord: undefined,
    evidenceRef: undefined,
    originalSellerText: "",
    fieldEvidence: publicEvidence(l.fieldEvidence),
    specs: publicEvidence(l.specs),
    description: cleanText(l.description),
    identityNotes: l.identityNotes
      .filter((n) => !n.startsWith("User-reviewed correction:"))
      .map(cleanText),
    flags: l.flags.map(cleanText),
    statusEvidence: l.statusEvidence ? cleanText(l.statusEvidence) : null,
    seller: {
      ...l.seller,
      name:
        l.seller.type === "private"
          ? "Private seller"
          : cleanText(l.seller.name),
    },
  };
}
