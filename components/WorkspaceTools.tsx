"use client";
import { useState } from "react";
import { listingSchema, type Listing } from "@/shared/schema";
import { identify, generation } from "@/shared/search";
export function ManualEntry({
  save,
  close,
}: {
  save: (l: Listing) => Promise<void>;
  close: () => void;
}) {
  const [form, setForm] = useState({
      title: "",
      url: "",
      price: "",
      city: "",
      state: "",
      seller: "Private seller",
    }),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const identity = identify(form.title),
            date = new Date().toISOString();
          const l = listingSchema.parse({
            id: `manual:${crypto.randomUUID()}`,
            sourceId: "manual",
            sourceName: "Manual entry",
            sourceListingId: crypto.randomUUID(),
            title: form.title,
            url: form.url,
            ...identity,
            generation: generation(identity),
            make:
              identity.model === "Mustang"
                ? "Ford"
                : identity.model
                  ? "Chevrolet"
                  : null,
            askingPrice: form.price ? Number(form.price) : null,
            saleType: "fixed",
            availability: "unknown",
            seller: {
              name: form.seller,
              type: "private",
              location:
                form.city && form.state
                  ? {
                      city: form.city,
                      state: form.state,
                      country: "US",
                      precision: "city",
                    }
                  : null,
            },
            firstSeenAt: date,
            lastObservedAt: date,
            description:
              "Manually entered observation. Availability, actual vehicle location and seller claims need review.",
            originalSellerText: form.title,
            parserVersion: "manual-v1",
            flags: ["User-entered record; not independently source-checked"],
          });
          await save(l);
          close();
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <p>
        Record an ad you found yourself. This does not fetch the source, message
        a seller, or confirm availability.
      </p>
      {[
        ["title", "Advertised title"],
        ["url", "Original listing URL"],
        ["price", "Asking price (optional)"],
        ["seller", "Seller name"],
        ["city", "Advertised city (optional)"],
        ["state", "Advertised state (optional)"],
      ].map(([key, label]) => (
        <label className="manual-field" key={key}>
          <span className="field-label">{label}</span>
          <input
            aria-label={label}
            required={["title", "url"].includes(key)}
            type={key === "price" ? "number" : key === "url" ? "url" : "text"}
            value={form[key as keyof typeof form]}
            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          />
        </label>
      ))}
      {error && <p role="alert">{error}</p>}
      <div className="button-row">
        <button className="button primary" type="submit">
          Save manual listing
        </button>
      </div>
    </form>
  );
}
export function ReviewedData({
  listing,
  save,
}: {
  listing: Listing;
  save: (patch: Record<string, unknown>) => Promise<void>;
}) {
  const [year, setYear] = useState(String(listing.year || "")),
    [evidence, setEvidence] = useState(listing.specialtyEvidence),
    [city, setCity] = useState(listing.vehicleLocation?.city || ""),
    [state, setState] = useState(listing.vehicleLocation?.state || ""),
    [lat, setLat] = useState(String(listing.vehicleLocation?.lat ?? "")),
    [lon, setLon] = useState(String(listing.vehicleLocation?.lon ?? "")),
    [note, setNote] = useState(""),
    [message, setMessage] = useState("");
  return (
    <details>
      <summary>Apply a reviewed identity or location correction</summary>
      <p className="field-help">
        Your correction preserves seller wording and invalidates the old route.
        Include the evidence you reviewed.
      </p>
      <label className="field-label">NORMALIZED MODEL YEAR</label>
      <input
        aria-label="Reviewed model year"
        type="number"
        value={year}
        onChange={(e) => setYear(e.target.value)}
      />
      <label className="field-label">SPECIALTY EVIDENCE</label>
      <select
        aria-label="Reviewed specialty evidence"
        value={evidence}
        onChange={(e) => setEvidence(e.target.value as typeof evidence)}
      >
        {[
          "unknown",
          "seller-claimed",
          "document-supported",
          "user-reviewed",
        ].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <label className="field-label">ACTUAL VEHICLE CITY / STATE</label>
      <div className="two-fields">
        <input
          aria-label="Reviewed vehicle city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <input
          aria-label="Reviewed vehicle state"
          value={state}
          onChange={(e) => setState(e.target.value)}
        />
      </div>
      <label className="field-label">COORDINATES · OPTIONAL</label>
      <div className="two-fields">
        <input
          aria-label="Reviewed latitude"
          type="number"
          step="any"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
        />
        <input
          aria-label="Reviewed longitude"
          type="number"
          step="any"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
        />
      </div>
      <label className="field-label">EVIDENCE / REASON</label>
      <textarea
        aria-label="Correction evidence"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="button-row">
        <button
          className="button secondary"
          disabled={note.trim().length < 5}
          onClick={async () => {
            try {
              await save({
                year: year ? Number(year) : null,
                specialtyEvidence: evidence,
                vehicleLocation:
                  city && state
                    ? {
                        city,
                        state,
                        country: "US",
                        precision: lat && lon ? "city" : "unknown",
                        ...(lat && lon
                          ? { lat: Number(lat), lon: Number(lon) }
                          : {}),
                      }
                    : null,
                reason: note,
              });
              setMessage(
                "Correction saved. Refresh driving routes for the new location.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            }
          }}
        >
          Apply reviewed correction
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
