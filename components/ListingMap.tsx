"use client";
import { useEffect, useRef, useState } from "react";
import { isOffsite } from "../shared/travel";
import type { Place } from "../shared/travel-contract";
import type { Listing } from "@/shared/schema";
import "leaflet/dist/leaflet.css";
export default function ListingMap({
  listings,
  onSelect,
  origin,
}: {
  listings: Listing[];
  origin?: Place;
  onSelect: (l: Listing) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const point = (l: Listing) =>
    isOffsite(l) ||
    l.travel?.basis === "ambiguous" ||
    (l.vehicleLocation &&
      ["ambiguous", "region", "unknown"].includes(
        l.vehicleLocation.precision,
      ) &&
      !l.travel?.place)
      ? null
      : l.travel?.place || l.vehicleLocation;
  const mapped = listings.filter((l) => {
    const p = point(l);
    return p?.lat != null && p.lon != null && !("offsite" in p && p.offsite);
  });
  useEffect(() => {
    let map: import("leaflet").Map | undefined,
      disposed = false;
    import("leaflet")
      .then((L) => {
        if (!el.current || disposed) return;
        map = L.map(el.current).setView([41.866, -88.107], 6);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 18,
        })
          .on("tileerror", () =>
            setError(
              "Map tiles are unavailable. Your result list is still usable.",
            ),
          )
          .addTo(map);
        if (origin)
          L.circleMarker([origin.lat, origin.lon], {
            radius: 8,
            color: "#23664b",
            fillOpacity: 1,
          })
            .bindTooltip("Starting city: " + origin.city)
            .addTo(map);
        const clusters = new Map<string, Listing[]>();
        mapped.forEach((l) => {
          const key = `${point(l)!.lat!.toFixed(2)},${point(l)!.lon!.toFixed(2)}`;
          clusters.set(key, [...(clusters.get(key) || []), l]);
        });
        clusters.forEach((group) => {
          const loc = point(group[0])!;
          const marker = L.circleMarker([loc.lat!, loc.lon!], {
            radius: group.length > 1 ? 18 : 9,
            color: "#fff",
            weight: 2,
            fillColor: group.some((l) => l.travel?.basis === "advertised-city")
              ? "#c68f35"
              : "#9c422d",
            fillOpacity: 1,
          }).addTo(map!);
          const popup = document.createElement("div");
          group.forEach((l) => {
            const b = document.createElement("button");
            b.textContent = l.title;
            b.className = "map-car-link";
            b.onclick = () => onSelect(l);
            popup.appendChild(b);
          });
          const tooltip = document.createElement("span");
          tooltip.textContent =
            group.length > 1
              ? `${group.length} ads · ${loc.city}`
              : group[0].title;
          marker.bindTooltip(tooltip);
          marker.bindPopup(popup);
        });
        if (mapped.length)
          map.fitBounds(
            [
              ...mapped.map(
                (l) => [point(l)!.lat!, point(l)!.lon!] as [number, number],
              ),
              ...(origin ? [[origin.lat, origin.lon] as [number, number]] : []),
            ],
            { padding: [35, 35], maxZoom: 10 },
          );
      })
      .catch(() =>
        setError("Map could not load. Switch to grid or list view."),
      );
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [listings, origin]);
  return (
    <div className="map-panel">
      <div className="map-caption">
        {mapped.length} of {listings.length} ads have mappable city estimates.
        Gold pins include advertised cities; rust pins are reported vehicle
        cities. Green is the starting city. No circular four-hour radius is
        implied.
      </div>
      <div
        ref={el}
        className="map-canvas"
        aria-label="Map of collected vehicle locations"
      />
      {error && <p role="status">{error}</p>}
    </div>
  );
}
