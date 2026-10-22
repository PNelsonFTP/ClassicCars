import { z } from "zod";
export const DEFAULT_ORIGIN = "US:IL:wheaton";
export const ROAD_PROFILE = "car-no-ferries-us-v1";
export const placeSchema = z.object({
  id: z.string().min(1).max(100),
  city: z.string().min(1).max(150),
  state: z.string().regex(/^[A-Z]{2}$/),
  country: z.literal("US").default("US"),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  kind: z.enum(["place", "subdivision", "postal"]),
  aliases: z.array(z.string()).default([]),
});
export type Place = z.infer<typeof placeSchema>;
const pointSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const roadEstimateSchema = z.object({
  originKey: z.string(),
  destinationId: z.string(),
  originPoint: pointSchema,
  destinationPoint: pointSchema,
  minutes: z.number().nonnegative().max(100000),
  miles: z.number().nonnegative(),
  computedAt: z.string().datetime(),
  provider: z.string().min(1),
  graphVersion: z.string().min(1),
  graphObservedAt: z.string().datetime(),
  profile: z.literal(ROAD_PROFILE),
  originSnapMeters: z.number().nonnegative(),
  destinationSnapMeters: z.number().nonnegative(),
});
export type RoadEstimate = z.infer<typeof roadEstimateSchema>;
export const travelAtlasSchema = z
  .object({
    version: z.literal(1),
    generatedAt: z.string().datetime(),
    origins: z.array(placeSchema),
    places: z.array(placeSchema),
    estimates: z.array(roadEstimateSchema),
    graph: z.object({
      version: z.string().min(1),
      sourceUrl: z.string().url(),
      observedAt: z.string().datetime(),
      profile: z.literal(ROAD_PROFILE),
      region: z.string(),
      attribution: z.string(),
      licenseUrl: z.string().url(),
    }),
    unresolved: z.record(z.string(), z.string()).default({}),
  })
  .superRefine((atlas, ctx) => {
    const origins = new Map(atlas.origins.map((p) => [placeKey(p), p]));
    const places = new Map(atlas.places.map((p) => [p.id, p]));
    if (
      origins.size !== atlas.origins.length ||
      places.size !== atlas.places.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Travel places and origins must have unique identifiers.",
      });
    const seen = new Set<string>();
    for (const e of atlas.estimates) {
      const origin = origins.get(e.originKey),
        destination = places.get(e.destinationId);
      const signature = `${e.originKey}:${e.destinationId}:${e.profile}`;
      if (
        !origin ||
        !destination ||
        e.graphVersion !== atlas.graph.version ||
        e.graphObservedAt !== atlas.graph.observedAt ||
        e.profile !== atlas.graph.profile ||
        seen.has(signature) ||
        e.originPoint[0] !== origin.lon ||
        e.originPoint[1] !== origin.lat ||
        e.destinationPoint[0] !== destination.lon ||
        e.destinationPoint[1] !== destination.lat
      )
        ctx.addIssue({
          code: "custom",
          message: `Road estimate context mismatch: ${signature}`,
        });
      seen.add(signature);
    }
  });
export type TravelAtlas = z.infer<typeof travelAtlasSchema>;
export const listingTravelSchema = z.object({
  basis: z.enum([
    "vehicle-city",
    "advertised-city",
    "reviewed-location",
    "offsite",
    "unknown",
    "ambiguous",
  ]),
  place: placeSchema.nullable(),
  estimates: z.array(roadEstimateSchema).default([]),
  reason: z.string(),
});
export type ListingTravel = z.infer<typeof listingTravelSchema>;
export const normalizePlaceName = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export const placeKey = (p: {
  city: string;
  state: string;
  country?: string;
}) =>
  `${p.country || "US"}:${p.state.toUpperCase()}:${normalizePlaceName(p.city)}`;
