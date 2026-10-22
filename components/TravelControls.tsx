"use client";
import { useState } from "react";
import type { Search, Snapshot } from "../shared/schema";
import { placeKey, placeSchema, type Place } from "../shared/travel-contract";
import {
  travelQuality,
  createPlaceIndex,
  resolvePlace,
} from "../shared/travel";
export default function TravelControls({
  filters,
  onChange,
  data,
  base,
  saveHome,
}: {
  filters: Search;
  onChange: (s: Search) => void;
  data: Snapshot;
  base: string;
  saveHome?: (p: Place) => Promise<void>;
}) {
  const [query, setQuery] = useState(""),
    [choices, setChoices] = useState<Place[]>([]),
    [error, setError] = useState("");
  const [catalog, setCatalog] = useState<Record<string, Place[]>>({}),
    [busy, setBusy] = useState(false);
  const origin = data.travelAtlas?.origins.find(
    (p) => placeKey(p) === filters.originKey,
  );
  const quality = travelQuality(data.listings, filters);
  const availabilityPreset =
    filters.availability.length === 1 && filters.availability[0] === "active"
      ? "active"
      : [...filters.availability].sort().join(",") === "active,pending,unknown"
        ? "recent"
        : [...filters.availability].sort().join(",") ===
            "active,pending,stale,unknown"
          ? "older"
          : "custom";
  async function lookup() {
    setBusy(true);
    setError("");
    try {
      const text = query.trim().toLowerCase();
      let state = text.match(/(?:,|\s)([a-z]{2})$/)?.[1]?.toUpperCase();
      if (/^\d{5}$/.test(text)) {
        const r = await fetch(`${base}/places/zip-index.json`);
        if (!r.ok) throw Error("ZIP catalog unavailable");
        state = (await r.json())[text];
      }
      if (!state)
        throw Error(
          "Enter city and two-letter state, or a supported 5-digit ZIP.",
        );
      let rows = catalog[state];
      if (!rows) {
        const r = await fetch(`${base}/places/${state}.json`);
        if (!r.ok) throw Error("City catalog unavailable");
        rows = (await r.json()).places.map((p: unknown) =>
          placeSchema.parse(p),
        );
        setCatalog({ ...catalog, [state]: rows });
      }
      const words = text.replace(/,/g, " ").split(/\s+/);
      const index = createPlaceIndex(rows);
      const found = rows.filter((p) =>
        /^\d{5}$/.test(text)
          ? p.kind === "postal" && p.aliases.includes(text)
          : p.kind !== "postal" &&
            words.every((w) =>
              `${p.city} ${p.state} ${p.aliases.join(" ")}`
                .toLowerCase()
                .includes(w),
            ) &&
            resolvePlace(p, index)?.id === p.id,
      );
      setChoices(
        found
          .filter(
            (p, i) =>
              found.findIndex(
                (x) => x.city === p.city && x.state === p.state,
              ) === i,
          )
          .slice(0, 12),
      );
      if (!found.length) setError("No place found. Check the city and state.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="travel-controls panel"
      aria-label="Home and approximate travel"
    >
      <div className="travel-controls-head">
        <div>
          <strong>
            About {filters.maxMinutes / 60} hours from{" "}
            {origin ? `${origin.city}, ${origin.state}` : filters.originLabel}
          </strong>
          <p className="field-help">
            Road travel to a city, with a planning margin rather than live
            traffic. Confirm where the car is kept.
          </p>
        </div>
        <label>
          Travel limit
          <select
            aria-label="Travel limit"
            value={filters.maxMinutes}
            onChange={(e) =>
              onChange({ ...filters, maxMinutes: Number(e.target.value) })
            }
          >
            {![60, 120, 180, 240, 360].includes(filters.maxMinutes) && (
              <option value={filters.maxMinutes}>
                {filters.maxMinutes} min (custom)
              </option>
            )}
            {[60, 120, 180, 240, 360].map((n) => (
              <option value={n} key={n}>
                About {n / 60} {n === 60 ? "hour" : "hours"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="button-row">
        <label>
          Travel basis
          <select
            aria-label="Travel basis"
            value={filters.travelMode}
            onChange={(e) =>
              onChange({
                ...filters,
                travelMode: e.target.value as Search["travelMode"],
              })
            }
          >
            <option value="approximate">Approximate city drive</option>
            <option value="strict">Reported vehicle routes only</option>
          </select>
        </label>
        <label>
          Planning margin
          <select
            aria-label="Planning margin"
            disabled={filters.travelMode === "strict"}
            value={filters.planningBuffer}
            onChange={(e) =>
              onChange({
                ...filters,
                planningBuffer: e.target.value as Search["planningBuffer"],
              })
            }
          >
            <option value="typical">Typical</option>
            <option value="conservative">Extra buffer</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            disabled={filters.travelMode === "strict"}
            checked={filters.includeBorderline}
            onChange={(e) =>
              onChange({ ...filters, includeBorderline: e.target.checked })
            }
          />{" "}
          Include near-limit cars
        </label>
        <label>
          <input
            type="checkbox"
            disabled={filters.travelMode === "strict"}
            checked={filters.allowAdvertisedLocation}
            onChange={(e) =>
              onChange({
                ...filters,
                allowAdvertisedLocation: e.target.checked,
              })
            }
          />{" "}
          Include advertised-city estimates
        </label>
        <label>
          Availability
          <select
            aria-label="Availability preset"
            value={availabilityPreset}
            onChange={(e) =>
              onChange({
                ...filters,
                availability:
                  e.target.value === "active"
                    ? ["active"]
                    : e.target.value === "older"
                      ? ["active", "unknown", "pending", "stale"]
                      : ["active", "unknown", "pending"],
              })
            }
          >
            <option value="custom" disabled>
              Custom availability selection
            </option>
            <option value="recent">Recently advertised + active</option>
            <option value="active">Seller reports active</option>
            <option value="older">Include older observations</option>
          </select>
        </label>
      </div>
      {!origin && (
        <p className="notice-box" role="status">
          No published road table for this starting city. Estimates remain
          unknown until it is generated.{" "}
          {data.travelAtlas?.origins.map((p) => (
            <button
              className="text-link"
              key={p.id}
              onClick={() =>
                onChange({
                  ...filters,
                  originKey: placeKey(p),
                  originLabel: `${p.city}, ${p.state}`,
                })
              }
            >
              Use {p.city}, {p.state}
            </button>
          ))}
        </p>
      )}
      <details>
        <summary>Change starting city or ZIP</summary>
        <div className="button-row">
          <input
            aria-label="Starting city or ZIP"
            placeholder="Wheaton, IL or 60187"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button secondary" disabled={busy} onClick={lookup}>
            {busy ? "Looking up…" : "Find city"}
          </button>
        </div>
        <div className="place-choices">
          {choices.map((p) => (
            <button
              className="button secondary"
              key={p.id}
              onClick={async () => {
                try {
                  if (saveHome) await saveHome(p);
                  onChange({
                    ...filters,
                    originKey: placeKey(p),
                    originLabel: `${p.city}, ${p.state}`,
                  });
                  setChoices([]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {p.city}, {p.state} · {p.kind === "postal" ? "ZIP area" : "city"}
            </button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
      </details>
      <p className="field-help" data-testid="travel-quality">
        {quality.estimates.toLocaleString()} road estimates ·{" "}
        {quality.borderline.toLocaleString()} near the selected limit ·{" "}
        {quality.unknown.toLocaleString()} unresolved.{" "}
        {data.travelAtlas
          ? `${data.travelAtlas.graph.region} · road data ${data.travelAtlas.graph.observedAt.slice(0, 10)} · no live traffic.`
          : "Travel data has not been generated."}
      </p>
      <details>
        <summary>Location and detail quality</summary>
        <p className="field-help">
          {quality.vehicleCities.toLocaleString()} ads report a vehicle city ·{" "}
          {quality.advertisedCities.toLocaleString()} have an advertised city ·{" "}
          {quality.ambiguous.toLocaleString()} city matches need review ·{" "}
          {quality.offsite.toLocaleString()} off-site ·{" "}
          {quality.nearbyAwaitingDetail.toLocaleString()} nearby ads await their
          first detail observation. Access failures and waiting source jobs are
          listed on Source coverage and connected Operations.
        </p>
      </details>
      <small className="field-help">
        ZIPs select a city; supported trips use the published city point. City
        reference: US Census. ZIP reference:{" "}
        <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">
          GeoNames (CC BY 4.0)
        </a>
        .{" "}
        {data.travelAtlas && (
          <>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              Roads © OpenStreetMap contributors (ODbL)
            </a>{" "}
            · OSRM.
          </>
        )}
      </small>
    </section>
  );
}
