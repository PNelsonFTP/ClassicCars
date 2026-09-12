import type { SourceConfig } from "./adapters";
// Deliberately incomplete: never manufacture an authorization grant or terminal scan.
export function sourceFeedTemplate(source: SourceConfig, now = new Date()) {
  return {
    manifest: {
      schemaVersion: 1,
      feedId: `${source.id}-provider-export`,
      sourceId: source.id,
      sourceName: source.name,
      generatedAt: now.toISOString(),
      scope: "nationwide",
      query: "Replace with the provider export query and covered years/models",
      authorization: {
        basis:
          source.id === "facebook"
            ? "user-owned-records"
            : source.category.toLowerCase().includes("dealer")
              ? "dealer-permission"
              : "provider-license",
        reference: "",
        reviewedAt: null,
        expiresAt: null,
        publicRedistribution: false,
        imageRedistribution: false,
      },
      allowedListingHosts: [new URL(source.url).hostname],
      allowedImageHosts: [],
      pagination: {
        cursor: null,
        nextCursor: null,
        terminal: false,
        declaredTotal: null,
      },
    },
    listings: [],
  };
}
