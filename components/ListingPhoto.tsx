"use client";
import { useState } from "react";
import { CarFront } from "lucide-react";
import type { Listing } from "../shared/schema";
export default function ListingPhoto({
  listing,
  large = false,
}: {
  listing: Listing;
  large?: boolean;
}) {
  // A new ad or changed URL list starts a fresh attempt; only this ad's own photos qualify.
  return (
    <PhotoAttempt
      key={listing.id + JSON.stringify(listing.photos)}
      listing={listing}
      large={large}
    />
  );
}
function PhotoAttempt({
  listing,
  large,
}: {
  listing: Listing;
  large: boolean;
}) {
  const [index, setIndex] = useState(0),
    [retry, setRetry] = useState(0);
  const src = listing.photos[index];
  return src ? (
    <img
      key={src + retry}
      className={large ? "detail-photo" : "car-photo"}
      src={src}
      alt={listing.title}
      title={`Photo from ${listing.sourceName}; original source retains rights.`}
      loading={large ? "eager" : "lazy"}
      onError={() => setIndex((i) => i + 1)}
    />
  ) : (
    <div className={`photo-placeholder ${large ? "large" : ""}`}>
      <CarFront size={50} strokeWidth={1} />
      <span>
        {listing.isSample ? "Fictional example" : "Photo unavailable"}
      </span>
      {large && listing.photos.length > 0 && (
        <button
          className="button secondary"
          onClick={() => {
            setIndex(0);
            setRetry((r) => r + 1);
          }}
        >
          Retry source photos
        </button>
      )}
    </div>
  );
}
