"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import {
  Search as SearchIcon,
  Compass,
  Heart,
  GitCompareArrows,
  Bookmark,
  ChartNoAxesCombined,
  Radio,
  Settings2,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Clock3,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Map as MapIcon,
  X,
  Plus,
  Check,
  Moon,
  Sun,
  ChevronDown,
  Download,
  Upload,
  CarFront,
  Flag,
  Info,
  RefreshCw,
  ExternalLink,
  Bell,
  Gauge,
  Menu,
} from "lucide-react";
import {
  defaultSearch,
  emptyWorkspace,
  listingSchema,
  searchSchema,
  workspaceSchema,
  type Listing,
  type Search,
  type Snapshot,
  type Workspace,
} from "@/shared/schema";
import {
  money,
  searchListings,
  quickSearch,
  routeKnown,
  storageKey,
  specFields,
  targetMatch,
} from "@/shared/search";
import DeliveryAttempts from "./DeliveryAttempts";
import DuplicateReview from "./DuplicateReview";
import { OperationsPanel } from "./OperationsPanel";
import Photo from "./ListingPhoto";
import EvidenceTimeline from "./EvidenceTimeline";
import { webMcpPatchSchema } from "../shared/webmcp";
import { unpackCatalog } from "../shared/catalog";
import { projectSnapshot } from "../shared/freshness";
import { apiRequest } from "../shared/api-client";
import { workspaceSaveQueue } from "../shared/workspace-save";
import ListingMap from "./ListingMap";
import { ManualEntry, ReviewedData } from "./WorkspaceTools";
const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
const empty: Snapshot = {
  schemaVersion: 1,
  generatedAt: null,
  listings: [],
  coverage: [],
  runs: [],
  limitations: [],
};
type Page =
  | "discover"
  | "favorites"
  | "compare"
  | "saved"
  | "market"
  | "coverage"
  | "settings";
const modeNames: Record<Search["mode"], string> = {
  everyday: "Everyday classics · within 4 hours",
  "unknown-route": "Travel time unknown · review",
  regional: "Broader regional ads",
  nationwide: "Nationwide classics",
  "identity-review": "Identity review",
  "specialty-review": "Specialty claims · review",
  auctions: "Upcoming & live auctions",
};
const fmtDate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not collected yet";
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <Switch.Root
      className="switch"
      checked={checked}
      onCheckedChange={onChange}
      aria-label={label}
    >
      <Switch.Thumb className="switch-thumb" />
    </Switch.Root>
  );
}
function Modal({
  open,
  onOpenChange,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className={`dialog ${wide ? "wide" : ""}`}>
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">
            Review details and manage your MuscleScout workspace.
          </Dialog.Description>
          <Dialog.Close className="icon-button close" aria-label="Close dialog">
            <X size={22} />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export default function MuscleScout() {
  const [displayLimit, setDisplayLimit] = useState(24),
    [page, setPage] = useState<Page>("discover"),
    [rawData, setData] = useState<Snapshot>(empty),
    [mode, setMode] = useState("snapshot"),
    [filters, setFilters] = useState<Search>(defaultSearch()),
    [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace()),
    [ready, setReady] = useState(false),
    [view, setView] = useState("grid"),
    [detail, setDetail] = useState<Listing | null>(null),
    [saveOpen, setSaveOpen] = useState(false),
    [saveName, setSaveName] = useState(""),
    [notice, setNotice] = useState(""),
    [dark, setDark] = useState(false),
    [mobileFilters, setMobileFilters] = useState(false),
    [backend, setBackend] = useState("http://127.0.0.1:4410"),
    [backendDraft, setBackendDraft] = useState("http://127.0.0.1:4410"),
    [password, setPassword] = useState(""),
    [token, setToken] = useState(""),
    [connecting, setConnecting] = useState(false),
    [manualOpen, setManualOpen] = useState(false),
    [importOpen, setImportOpen] = useState(false),
    [importText, setImportText] = useState(""),
    [history, setHistory] = useState<
      { kind: string; amount: number | null; observedAt: string }[]
    >([]),
    [alerts, setAlerts] = useState<
      { id: string; message: string; kind: string; createdAt: string }[]
    >([]),
    [deliveries, setDeliveries] = useState<
      {
        id: string;
        channel: string;
        status: string;
        attempts: number;
        error: string | null;
      }[]
    >([]),
    [settings, setSettings] = useState<Record<string, unknown>>({}),
    [busy, setBusy] = useState(false);
  const [viewTime, setViewTime] = useState(Date.now());
  const data = useMemo(
    () => projectSnapshot(rawData, viewTime),
    [rawData, viewTime],
  );
  useEffect(() => {
    const timer = setInterval(() => setViewTime(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => setDisplayLimit(24), [filters, page]);
  const workspaceKey = storageKey(base, mode, backend),
    workspaceWriter = useRef<ReturnType<
      typeof workspaceSaveQueue<Workspace>
    > | null>(null),
    loadedKey = useRef("");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const connectionRef = useRef("");
  connectionRef.current = `${mode}:${backend}:${token}`;
  function inform(s: string) {
    setNotice(s);
  }
  const api = useCallback(
    async <T = any,>(
      path: string,
      options: RequestInit = {},
      auth = token,
    ): Promise<T> => {
      try {
        return await apiRequest<T>(backend, auth, path, options);
      } catch (error) {
        if (
          (error as { status?: number }).status === 401 &&
          auth &&
          connectionRef.current === `${modeRef.current}:${backend}:${auth}`
        ) {
          sessionStorage.removeItem(storageKey(base, "connection"));
          setToken("");
          setMode("snapshot");
        }
        throw error;
      }
    },
    [backend, token],
  );
  async function refresh() {
    if (mode === "connected") {
      const connection = connectionRef.current;
      const result = await api("/api/snapshot");
      const nextSettings = await api("/api/settings");
      const a = await api("/api/alerts");
      const attempts = await api("/api/delivery-attempts");
      if (connectionRef.current !== connection) return;
      setSettings(nextSettings);
      setData(result);
      setAlerts(a);
      setDeliveries(attempts);
    } else if (mode === "sample" && process.env.NODE_ENV === "development") {
      const { sampleListings } = await import("@/shared/sample");
      setData({
        ...empty,
        generatedAt: "2026-09-08T02:00:00Z",
        listings: sampleListings,
        limitations: [
          "Fictional examples. Sample routes and prices are not actual vehicles or trips.",
        ],
      });
    } else {
      let response = await fetch(`${base}/data/catalog.json`, {
        cache: "no-store",
      });
      if (response.status === 404)
        response = await fetch(`${base}/data/snapshot.json`, {
          cache: "no-store",
        });
      if (!response.ok)
        throw new Error("Published snapshot could not be loaded.");
      const result = unpackCatalog<Snapshot>(await response.json());
      if (modeRef.current !== mode) return;
      let manual: Listing[] = [];
      try {
        manual = JSON.parse(
          localStorage.getItem(workspaceKey + ":inventory") || "[]",
        )
          .map((l: unknown) => listingSchema.parse(l))
          .filter((l: Listing) => mode === "sample" || !l.isSample);
      } catch {}
      const observed = result.listings.map((l: unknown) =>
        listingSchema.parse(l),
      );
      setData({
        ...result,
        listings: [
          ...observed,
          ...manual.filter(
            (l) => !observed.some((x: Listing) => x.id === l.id),
          ),
        ],
      });
    }
  }
  useEffect(() => {
    try {
      setDark(localStorage.getItem(storageKey(base, "theme")) === "dark");
      const connection = JSON.parse(
        sessionStorage.getItem(storageKey(base, "connection")) || "null",
      );
      if (connection?.token && connection?.backend) {
        setBackend(connection.backend);
        setBackendDraft(connection.backend);
        setToken(connection.token);
        setMode("connected");
      }
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try {
      localStorage.setItem(storageKey(base, "theme"), dark ? "dark" : "light");
    } catch {}
  }, [dark]);
  useEffect(() => {
    let active = true;
    setReady(false);
    loadedKey.current = "";
    refresh().catch((e) => inform(e.message));
    if (mode !== "connected") {
      try {
        setWorkspace(
          workspaceSchema.parse(
            JSON.parse(localStorage.getItem(workspaceKey) || "{}"),
          ),
        );
      } catch {
        setWorkspace(emptyWorkspace());
        inform(
          "Stored workspace could not be read; import a backup to recover it.",
        );
      }
      loadedKey.current = workspaceKey;
      setReady(true);
    } else {
      api("/api/workspace")
        .then((r) => {
          if (!active) return;
          const loaded = workspaceSchema.parse(r.workspace);
          workspaceWriter.current = workspaceSaveQueue({
            initial: loaded,
            revision: r.revision,
            send: (value, revision) =>
              api("/api/workspace", {
                method: "PUT",
                body: JSON.stringify({ workspace: value, revision }),
              }),
            onError: (error) =>
              inform(
                `Workspace save failed: ${(error as Error).message}. Your latest edits remain on screen; export them before reconnecting.`,
              ),
          });
          setWorkspace(loaded);
          loadedKey.current = workspaceKey;
          setReady(true);
        })
        .catch((e) => inform(e.message));
    }
    return () => {
      active = false;
      workspaceWriter.current?.dispose();
      workspaceWriter.current = null;
    };
  }, [mode, workspaceKey, token]);
  useEffect(() => {
    if (!ready || loadedKey.current !== workspaceKey) return;
    if (mode === "connected") {
      workspaceWriter.current?.enqueue(workspace);
    } else {
      try {
        localStorage.setItem(workspaceKey, JSON.stringify(workspace));
      } catch {
        inform(
          "Browser storage is full or unavailable. Export your workspace to preserve changes.",
        );
      }
    }
  }, [workspace, ready]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  const detailCache = useRef(new Map<string, Listing[]>());
  useEffect(() => {
    const filename = detail && data.detailFiles?.[detail.id];
    if (!detail || !filename || mode === "connected") return;
    let active = true;
    const id = detail.id;
    if (!/^details\/[a-f0-9]{24}\.json$/.test(filename)) return;
    const cached = detailCache.current.get(filename);
    const load = cached
      ? Promise.resolve(cached)
      : fetch(`${base}/data/${filename}`).then(async (r) => {
          if (!r.ok)
            throw new Error(
              "Full source details could not be loaded. Retry by reopening this ad.",
            );
          return (await r.json()).map((l: unknown) =>
            listingSchema.parse(l),
          ) as Listing[];
        });
    load
      .then((rows) => {
        detailCache.current.set(filename, rows);
        if (!active) return;
        const full = rows.find((l) => l.id === id);
        if (full)
          setDetail(
            projectSnapshot(
              {
                ...empty,
                listings: [full],
                freshnessPolicy: data.freshnessPolicy,
              },
              Date.now(),
            ).listings[0],
          );
      })
      .catch((e) => inform(e.message));
    return () => {
      active = false;
    };
  }, [detail?.id, data.detailFiles, mode]);
  useEffect(() => {
    if (detail && mode === "connected")
      api(`/api/listings/${encodeURIComponent(detail.id)}/history`)
        .then(setHistory)
        .catch(() => setHistory([]));
    else setHistory([]);
  }, [detail, mode]);
  useEffect(() => {
    const ctx = (
      document as unknown as {
        modelContext?: {
          registerTool: (t: unknown, o: unknown) => Promise<void>;
        };
      }
    ).modelContext;
    if (!ctx) return;
    const lifecycle = new AbortController();
    ctx
      .registerTool(
        {
          name: "search_musclescout",
          description:
            "Apply validated classic-car search filters to the visible Discover view.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
              mode: { type: "string", enum: Object.keys(modeNames) },
              specialty: { type: "boolean" },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute(input: unknown) {
            const parsed = webMcpPatchSchema.parse(input);
            setFilters((p) => searchSchema.parse({ ...p, ...parsed }));
            setPage("discover");
            return { applied: parsed };
          },
        },
        { signal: lifecycle.signal },
      )
      .catch(() => {});
    return () => lifecycle.abort();
  }, []);
  const results = useMemo(
    () =>
      page === "favorites"
        ? (() => {
            const rows = data.listings.filter(
              (l) =>
                workspace.favorites.includes(l.id) &&
                (!filters.query ||
                  l.title.toLowerCase().includes(filters.query.toLowerCase())),
            );
            return {
              rows,
              rawCount: rows.length,
              groupCount: new Set(rows.map((l) => l.groupId || l.id)).size,
            };
          })()
        : searchListings(
            data.listings,
            { ...filters, favoritesOnly: false },
            workspace,
          ),
    [data, filters, workspace, page],
  );
  const classics = data.listings.filter((l) => targetMatch(l, defaultSearch())),
    unknown = classics.filter(
      (l) => !routeKnown(l, Date.now(), filters.routeMaxAgeDays),
    ),
    within = classics.filter(
      (l) =>
        routeKnown(l, Date.now(), filters.routeMaxAgeDays) &&
        l.route!.minutes <= 240 &&
        l.availability === "active" &&
        ["fixed", "negotiable"].includes(l.saleType),
    );
  const homeLabel =
    mode === "connected" && settings.home
      ? `${(settings.home as { city: string }).city}, ${(settings.home as { state: string }).state}`
      : "Wheaton, Illinois";
  const favorites = data.listings.filter((l) =>
    workspace.favorites.includes(l.id),
  );
  const compared = data.listings.filter((l) =>
    workspace.compare.includes(l.id),
  );
  function set<K extends keyof Search>(key: K, value: Search[K]) {
    setFilters((p) => ({ ...p, [key]: value }));
  }
  function choose(scope: Search["mode"]) {
    setFilters((p) => quickSearch(scope, p));
    setPage("discover");
    if (scope === "nationwide" && mode === "connected")
      api("/api/collection/expand", { method: "POST", body: "{}" })
        .then(() =>
          inform(
            "Nationwide collection queued. Coverage will show progress and gaps.",
          ),
        )
        .catch((e) => inform(e.message));
  }
  function favorite(id: string) {
    setWorkspace((w) => ({
      ...w,
      favorites: w.favorites.includes(id)
        ? w.favorites.filter((x) => x !== id)
        : [...w.favorites, id],
    }));
  }
  function compare(id: string) {
    setWorkspace((w) => {
      if (w.compare.includes(id))
        return { ...w, compare: w.compare.filter((x) => x !== id) };
      if (w.compare.length >= 6) {
        inform("You can compare up to six cars.");
        return w;
      }
      return { ...w, compare: [...w.compare, id] };
    });
  }
  function download(value: unknown, name: string) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function connect() {
    setConnecting(true);
    try {
      const target = new URL(backendDraft.trim());
      if (
        !["http:", "https:"].includes(target.protocol) ||
        target.username ||
        target.password ||
        target.search ||
        target.hash
      )
        throw new Error(
          "Use an HTTP or HTTPS backend URL without credentials, query or fragment.",
        );
      const authenticatedBackend = target.href.replace(/\/$/, "");
      const result = await apiRequest<{ token: string }>(
        authenticatedBackend,
        "",
        "/api/login",
        {
          method: "POST",
          body: JSON.stringify({ password }),
        },
      );
      const nextSettings = await apiRequest<Record<string, unknown>>(
        authenticatedBackend,
        result.token,
        "/api/settings",
      );
      setBackend(authenticatedBackend);
      setBackendDraft(authenticatedBackend);
      setToken(result.token);
      sessionStorage.setItem(
        storageKey(base, "session", authenticatedBackend),
        result.token,
      );
      sessionStorage.setItem(
        storageKey(base, "connection"),
        JSON.stringify({ backend: authenticatedBackend, token: result.token }),
      );
      setPassword("");
      setMode("connected");
      setSettings(nextSettings);
      inform("Connected to your private local workspace.");
    } catch (e) {
      inform((e as Error).message);
    } finally {
      setConnecting(false);
    }
  }
  async function importData() {
    try {
      const raw = JSON.parse(importText);
      if (raw.favorites || raw.notes || raw.searches) {
        const imported = workspaceSchema.parse(raw);
        setWorkspace((w) => ({
          ...w,
          favorites: [...new Set([...w.favorites, ...imported.favorites])],
          notes: { ...imported.notes, ...w.notes },
          flags: { ...imported.flags, ...w.flags },
          corrections: { ...imported.corrections, ...w.corrections },
          searches: [
            ...w.searches,
            ...imported.searches.filter(
              (s) => !w.searches.some((x) => x.id === s.id),
            ),
          ],
        }));
        inform(
          "Workspace merged. Existing notes and saved searches were preserved.",
        );
      } else {
        const listings = Array.isArray(raw) ? raw : raw.listings;
        if (!Array.isArray(listings))
          throw new Error("Expected a workspace or listing array.");
        if (mode === "connected") {
          const result = await api("/api/import", {
            method: "POST",
            body: JSON.stringify({ listings }),
          });
          inform(
            `Imported ${result.accepted}; rejected ${result.rejected.length}. ${result.rejected.map((r: { reason: string }) => r.reason).join("; ")}`,
          );
          await refresh();
        } else {
          const parsed = listings.map((l) => listingSchema.parse(l));
          if (mode === "snapshot" && parsed.some((l) => l.isSample))
            throw new Error(
              "Sample listings cannot be imported into a real snapshot workspace.",
            );
          const existing: Listing[] = JSON.parse(
            localStorage.getItem(workspaceKey + ":inventory") || "[]",
          );
          localStorage.setItem(
            workspaceKey + ":inventory",
            JSON.stringify([
              ...existing,
              ...parsed.filter((l) => !existing.some((x) => x.id === l.id)),
            ]),
          );
          setData((d) => ({
            ...d,
            listings: [
              ...d.listings,
              ...parsed.filter((l) => !d.listings.some((x) => x.id === l.id)),
            ],
          }));
          inform("Listings merged and saved in this browser workspace.");
        }
      }
      setImportOpen(false);
    } catch (e) {
      inform(`Import rejected: ${(e as Error).message}`);
    }
  }
  const navigation: {
    id: Page;
    label: string;
    icon: typeof Compass;
    count?: number;
  }[] = [
    { id: "discover", label: "Discover", icon: Compass },
    {
      id: "favorites",
      label: "Shortlist",
      icon: Heart,
      count: workspace.favorites.length,
    },
    {
      id: "compare",
      label: "Compare",
      icon: GitCompareArrows,
      count: workspace.compare.length,
    },
    { id: "saved", label: "Saved searches", icon: Bookmark },
    { id: "market", label: "Market overview", icon: ChartNoAxesCombined },
    { id: "coverage", label: "Source coverage", icon: Radio },
  ];
  const carCard = (l: Listing) => (
    <article
      className={`car-card ${view === "list" ? "list-card" : ""}`}
      key={l.id}
    >
      <button
        className="photo-button"
        onClick={() => setDetail(l)}
        aria-label={`View ${l.title}`}
      >
        <Photo listing={l} />
        <span className="photo-count">
          {l.photos.length ? `${l.photos.length} photos` : "No photos"}
        </span>
        {l.isSample && <span className="sample-ribbon">FICTIONAL EXAMPLE</span>}
      </button>
      <button
        className={`favorite ${workspace.favorites.includes(l.id) ? "selected" : ""}`}
        onClick={() => favorite(l.id)}
        aria-label={`${workspace.favorites.includes(l.id) ? "Remove" : "Add"} ${l.title} ${workspace.favorites.includes(l.id) ? "from" : "to"} shortlist`}
      >
        <Heart
          size={18}
          fill={workspace.favorites.includes(l.id) ? "currentColor" : "none"}
        />
      </button>
      <div className="card-body">
        <div className="card-kicker">
          {l.model || "Identity review"}{" "}
          <span>· {l.generation || l.trim || "Classic collection"}</span>
        </div>
        <button className="car-title" onClick={() => setDetail(l)}>
          {l.title}
        </button>
        <div className="price-row">
          <strong>
            {l.saleType === "auction"
              ? money(l.currentBid)
              : money(l.askingPrice)}
          </strong>
          <span>
            {l.saleType === "auction" ? "CURRENT BID" : "ASKING PRICE"}
          </span>
        </div>
        <div className="car-specs">
          <span>
            {String(l.specs.engineInstalled?.value || "Engine not stated")}
          </span>
          <i />
          <span>
            {String(l.specs.transmission?.value || "Transmission unknown")}
          </span>
        </div>
        <div className="location-row">
          <MapPin size={14} />
          {l.vehicleLocation
            ? `${l.vehicleLocation.city}, ${l.vehicleLocation.state}`
            : "Vehicle location unknown"}
        </div>
        <div
          className={`travel ${routeKnown(l, Date.now(), filters.routeMaxAgeDays) ? "known" : ""}`}
        >
          <Clock3 size={14} />
          {routeKnown(l, Date.now(), filters.routeMaxAgeDays)
            ? `~${Math.floor(l.route!.minutes / 60)}h ${Math.round(l.route!.minutes % 60)}m drive`
            : "Drive time unavailable"}
          {l.straightLineMiles != null && (
            <span>· {Math.round(l.straightLineMiles)} mi straight-line</span>
          )}
        </div>
        <div className="card-footer">
          <span>
            <span
              className={`status-dot ${l.availability === "active" ? "green" : ""}`}
            />
            {l.sourceName}
          </span>
          <button
            onClick={() => compare(l.id)}
            className={workspace.compare.includes(l.id) ? "compared" : ""}
            aria-label={`Compare ${l.title}`}
          >
            {workspace.compare.includes(l.id) ? (
              <Check size={14} />
            ) : (
              <Plus size={14} />
            )}{" "}
            Compare
          </button>
        </div>
        <div className="freshness">
          {l.availability.replace(/-/g, " ")} · Observed{" "}
          {fmtDate(l.lastObservedAt)}
        </div>
      </div>
    </article>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href={`${base}/`}>
          <span className="brand-mark">
            <Gauge size={27} />
          </span>
          <span>
            Muscle<span className="brand-light">Scout</span>
            <small>THE SEARCH IS PART OF THE DRIVE.</small>
          </span>
        </a>
        <div className="nav-caption">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setPage(n.id);
                if (n.id === "favorites")
                  setFilters((p) => ({
                    ...quickSearch("regional", p),
                    mode: "nationwide",
                    availability: [],
                    saleTypes: [],
                  }));
              }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {!!n.count && <b>{n.count}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="home-card">
            <MapPin size={17} />
            <div>
              <strong>{homeLabel}</strong>
              <small>Your starting point · city center</small>
            </div>
          </div>
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => setPage("settings")}
          >
            <Settings2 size={18} />
            <span>Settings & connection</span>
          </button>
          <div className="sidebar-foot">
            <span>BUILT FOR THE LONG WAY HOME.</span>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label="Toggle dark mode"
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Your garage <span>/</span>{" "}
            {navigation.find((n) => n.id === page)?.label || "Settings"}
          </div>
          <div className="topbar-right">
            <span
              className={`connection-pill ${mode === "connected" ? "connected" : ""}`}
            >
              <span className="status-dot" />
              {mode === "sample"
                ? "Sample · fictional"
                : mode === "connected"
                  ? "Connected · local API"
                  : "Published snapshot"}
            </span>
            <button
              className="icon-button"
              aria-label="View alerts"
              onClick={() => {
                setPage("saved");
              }}
            >
              <Bell size={18} />
              {alerts.length > 0 && <sup>{alerts.length}</sup>}
            </button>
            <button
              className="avatar"
              onClick={() => setPage("settings")}
              aria-label="Workspace settings"
            >
              PN
            </button>
          </div>
        </header>
        <div className="main-content">
          {(page === "discover" || page === "favorites") && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">GOOD CARS. A LITTLE CLOSER.</div>
                  <h1>
                    {page === "favorites"
                      ? "Your next-car shortlist."
                      : "Find your next chapter."}
                  </h1>
                  <p>
                    {page === "favorites"
                      ? "The cars worth coming back to. Your notes stay with you."
                      : "Mustangs, Camaros & Corvettes. One place to find the one."}
                  </p>
                </div>
                <button
                  className="button secondary save-button"
                  onClick={() => {
                    setSaveName(modeNames[filters.mode]);
                    setSaveOpen(true);
                  }}
                >
                  <Bookmark size={16} />
                  Save search
                </button>
              </div>
              <section className="scope-banner">
                <div className="scope-main">
                  <span className="scope-icon">
                    <MapPin size={21} />
                  </span>
                  <div>
                    <strong>
                      {filters.mode === "nationwide"
                        ? "Across the United States"
                        : `Starting in ${homeLabel}`}
                    </strong>
                    <span>
                      {modeNames[filters.mode]} <b>·</b> {filters.minYear}–
                      {filters.maxYear}
                    </span>
                  </div>
                </div>
                <button onClick={() => setPage("coverage")}>
                  Explore coverage <ArrowUpRight size={16} />
                </button>
              </section>
              <div className="search-toolbar">
                <div className="search-field">
                  <SearchIcon size={19} />
                  <input
                    aria-label="Search cars"
                    placeholder="Search a year, model, engine, or a little inspiration…"
                    value={filters.query}
                    onChange={(e) => set("query", e.target.value)}
                  />
                  {filters.query && (
                    <button
                      aria-label="Clear search"
                      onClick={() => set("query", "")}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  className="button secondary filter-mobile"
                  onClick={() => setMobileFilters(!mobileFilters)}
                >
                  <SlidersHorizontal size={17} />
                  Filters
                </button>
              </div>
              <div className="model-tabs">
                <button
                  className={filters.models.length === 3 ? "selected" : ""}
                  onClick={() =>
                    set("models", ["Mustang", "Camaro", "Corvette"])
                  }
                >
                  All classics <span>{classics.length}</span>
                </button>
                {(["Mustang", "Camaro", "Corvette"] as const).map((model) => (
                  <button
                    key={model}
                    className={
                      filters.models.length === 1 && filters.models[0] === model
                        ? "selected"
                        : ""
                    }
                    onClick={() => set("models", [model])}
                  >
                    {model}s{" "}
                    <span>
                      {classics.filter((l) => l.model === model).length}
                    </span>
                  </button>
                ))}
                <div className="specialty-inline">
                  <label htmlFor="specialty-control">
                    Include specialty Mustangs
                  </label>
                  <span id="specialty-control">
                    <Toggle
                      label="Include specialty Mustangs"
                      checked={filters.specialty}
                      onChange={(v) => set("specialty", v)}
                    />
                  </span>
                </div>
              </div>
              <div className="discovery-layout">
                <aside
                  className={`filter-rail ${mobileFilters ? "mobile-open" : ""}`}
                >
                  <div className="filter-title">
                    <SlidersHorizontal size={16} />
                    <strong>Refine your search</strong>
                    <button onClick={() => setFilters(defaultSearch())}>
                      Reset
                    </button>
                  </div>
                  <label className="field-label">SEARCH AREA</label>
                  <select
                    aria-label="Search scope"
                    value={filters.mode}
                    onChange={(e) => choose(e.target.value as Search["mode"])}
                  >
                    {Object.entries(modeNames).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <p className="field-help">
                    Four hours means a known road route. Unknown routes have a
                    separate review view.
                  </p>
                  <div className="filter-section">
                    <label className="field-label">MODEL YEAR</label>
                    <div className="two-fields">
                      <input
                        type="number"
                        aria-label="Minimum model year"
                        value={filters.minYear}
                        onChange={(e) => set("minYear", Number(e.target.value))}
                      />
                      <span>—</span>
                      <input
                        type="number"
                        aria-label="Maximum model year"
                        value={filters.maxYear}
                        onChange={(e) => set("maxYear", Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div className="filter-section">
                    <label className="field-label">ASKING PRICE</label>
                    <div className="two-fields">
                      <input
                        type="number"
                        min="0"
                        aria-label="Minimum asking price"
                        placeholder="No min"
                        value={filters.minPrice ?? ""}
                        onChange={(e) =>
                          set(
                            "minPrice",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                      <span>—</span>
                      <input
                        type="number"
                        min="0"
                        aria-label="Maximum asking price"
                        placeholder="No max"
                        value={filters.maxPrice ?? ""}
                        onChange={(e) =>
                          set(
                            "maxPrice",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                      />
                    </div>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={filters.unknownPrice}
                        onChange={(e) => set("unknownPrice", e.target.checked)}
                      />
                      Include price on request
                    </label>
                  </div>
                  <div className="filter-section">
                    <label className="field-label">TRANSMISSION</label>
                    <select
                      aria-label="Transmission"
                      value={String(
                        filters.rules.find(
                          (r) => r.field === "specs.transmission",
                        )?.value || "",
                      )}
                      onChange={(e) =>
                        set("rules", [
                          ...filters.rules.filter(
                            (r) => r.field !== "specs.transmission",
                          ),
                          ...(e.target.value
                            ? [
                                {
                                  field: "specs.transmission",
                                  operator: "include" as const,
                                  value: e.target.value,
                                },
                              ]
                            : []),
                        ])
                      }
                    >
                      <option value="">Any transmission</option>
                      <option>Manual</option>
                      <option>Automatic</option>
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={filters.rules.some(
                          (r) => r.field === "specs.cylinders" && r.value === 8,
                        )}
                        onChange={(e) =>
                          set("rules", [
                            ...filters.rules.filter(
                              (r) => r.field !== "specs.cylinders",
                            ),
                            ...(e.target.checked
                              ? [
                                  {
                                    field: "specs.cylinders",
                                    operator: "include" as const,
                                    value: 8,
                                  },
                                ]
                              : []),
                          ])
                        }
                      />
                      V8 only <span className="muted">optional</span>
                    </label>
                  </div>
                  <div className="filter-section">
                    <label className="field-label">CONDITION</label>
                    <select
                      aria-label="Condition"
                      value={String(
                        filters.rules.find((r) => r.field === "specs.condition")
                          ?.value || "",
                      )}
                      onChange={(e) =>
                        set("rules", [
                          ...filters.rules.filter(
                            (r) => r.field !== "specs.condition",
                          ),
                          ...(e.target.value
                            ? [
                                {
                                  field: "specs.condition",
                                  operator: "include" as const,
                                  value: e.target.value,
                                },
                              ]
                            : []),
                        ])
                      }
                    >
                      <option value="">Any condition, including unknown</option>
                      <option>Project</option>
                      <option>Driver</option>
                      <option>Show</option>
                    </select>
                  </div>
                  {filters.specialty && (
                    <div className="filter-section specialty-section">
                      <label className="field-label">SPECIALTY EXPANSION</label>
                      {[
                        "SVT/Cobra",
                        "Shelby GT350/GT500",
                        "Mach 1",
                        "Boss",
                        "GTD",
                      ].map((v) => (
                        <label className="check-label" key={v}>
                          <input
                            type="checkbox"
                            checked={filters.variants.includes(v)}
                            onChange={(e) =>
                              set(
                                "variants",
                                e.target.checked
                                  ? [...filters.variants, v]
                                  : filters.variants.filter((x) => x !== v),
                              )
                            }
                          />
                          {v}
                        </label>
                      ))}
                      <label className="check-label">
                        Through model year{" "}
                        <input
                          type="number"
                          aria-label="Specialty upper model year"
                          value={filters.specialtyMaxYear}
                          onChange={(e) =>
                            set("specialtyMaxYear", +e.target.value)
                          }
                        />
                      </label>
                      <p className="field-help">
                        Document-supported or user-reviewed claims. Later
                        ordinary Mustangs stay excluded.
                      </p>
                      <button
                        className="text-link"
                        onClick={() => choose("specialty-review")}
                      >
                        Review seller claims <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                  <details className="filter-section">
                    <summary>
                      More filters <ChevronDown size={14} />
                    </summary>
                    <label className="field-label">STATES · MATCH ANY</label>
                    <input
                      aria-label="States separated by commas"
                      placeholder="IL, WI, IN"
                      value={filters.states.join(",")}
                      onChange={(e) =>
                        set(
                          "states",
                          e.target.value
                            .toUpperCase()
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        )
                      }
                    />
                    <label className="field-label">AVAILABILITY</label>
                    <select
                      aria-label="Availability"
                      value={
                        filters.availability.length === 1
                          ? filters.availability[0]
                          : ""
                      }
                      onChange={(e) =>
                        set(
                          "availability",
                          e.target.value ? [e.target.value] : [],
                        )
                      }
                    >
                      <option value="">Any availability</option>
                      {[
                        "active",
                        "pending",
                        "sold",
                        "removed",
                        "stale",
                        "upcoming-auction",
                        "live-auction",
                        "auction-ended",
                        "unknown",
                      ].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                    <label className="field-label">EXCLUDE WORDS</label>
                    <input
                      aria-label="Exclude description words"
                      placeholder="Comma-separated words"
                      value={filters.excludeText}
                      onChange={(e) => set("excludeText", e.target.value)}
                    />
                    <label className="field-label">
                      SPECIFICATIONS & CLAIMS
                    </label>
                    {filters.rules
                      .filter(
                        (r) =>
                          ![
                            "specs.transmission",
                            "specs.cylinders",
                            "specs.condition",
                          ].includes(r.field),
                      )
                      .map((r, i) => (
                        <div className="rule" key={i}>
                          {specFields[r.field.replace("specs.", "")] || r.field}{" "}
                          {r.operator} {String(r.value ?? "")}
                          <button
                            aria-label="Remove filter rule"
                            onClick={() =>
                              set(
                                "rules",
                                filters.rules.filter((x) => x !== r),
                              )
                            }
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    <RuleBuilder
                      add={(r) => set("rules", [...filters.rules, r])}
                    />
                  </details>
                  <div className="filter-note">
                    <Info size={16} />
                    <span>
                      No hidden preferences. Projects, six-cylinder cars and
                      unknown specifications are welcome.
                    </span>
                  </div>
                </aside>
                <section className="results">
                  <div className="results-heading">
                    <div>
                      <strong>
                        {results.rows.length}{" "}
                        {page === "favorites" ? "shortlisted cars" : "results"}
                      </strong>
                      <span>
                        {results.rawCount} ads · {results.groupCount} groups
                      </span>
                    </div>
                    <div className="result-controls">
                      <select
                        aria-label="Sort results"
                        value={filters.sort}
                        onChange={(e) =>
                          set("sort", e.target.value as Search["sort"])
                        }
                      >
                        <option value="nearest">Nearest first</option>
                        <option value="price-asc">
                          Asking price: low to high
                        </option>
                        <option value="price-desc">
                          Asking price: high to low
                        </option>
                        <option value="newest">First tracked: newest</option>
                        <option value="year">Model year: newest</option>
                        <option value="deadline">Auction deadline</option>
                      </select>
                      <div className="view-switch">
                        {[
                          { id: "grid", icon: LayoutGrid },
                          { id: "list", icon: List },
                          { id: "map", icon: MapIcon },
                        ].map((v) => (
                          <button
                            className={view === v.id ? "selected" : ""}
                            key={v.id}
                            aria-label={`${v.id} view`}
                            aria-pressed={view === v.id}
                            onClick={() => setView(v.id)}
                          >
                            <v.icon size={16} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="active-filters">
                    <span>
                      {filters.minYear}–{filters.maxYear}
                    </span>
                    <span>
                      {filters.mode === "everyday"
                        ? "≤ 4 hours · route required"
                        : modeNames[filters.mode]}
                    </span>
                    {filters.specialty && (
                      <span className="special-chip">+ Specialty Mustangs</span>
                    )}
                    {filters.query && (
                      <button onClick={() => set("query", "")}>
                        {filters.query}
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  <div className="review-notice">
                    <Info size={16} />
                    <p>
                      {unknown.length ? (
                        <>
                          <strong>
                            {unknown.length} classics need a travel-time check.
                          </strong>{" "}
                          They aren’t counted as within four hours.
                        </>
                      ) : (
                        <>
                          Every result reflects the data actually collected.
                          Coverage is still growing.
                        </>
                      )}
                    </p>
                    <button onClick={() => choose("unknown-route")}>
                      Review cars <ArrowRight size={15} />
                    </button>
                  </div>
                  {filters.mode === "nationwide" && (
                    <div className="notice-box">
                      Nationwide shows collected US inventory.{" "}
                      {mode === "connected"
                        ? "A broader collection job is requested when this scope is selected."
                        : "Connect the local backend to collect additional nationwide sources."}{" "}
                      This is not complete national coverage.
                    </div>
                  )}
                  {view === "map" ? (
                    <ListingMap listings={results.rows} onSelect={setDetail} />
                  ) : results.rows.length ? (
                    <div
                      className={`car-grid ${view === "list" ? "as-list" : ""}`}
                    >
                      {results.rows
                        .slice(displayLimit - 24, displayLimit)
                        .map(carCard)}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Compass size={40} strokeWidth={1} />
                      <h2>
                        {filters.mode === "everyday"
                          ? "The right car starts with an honest search."
                          : "No cars match this view yet."}
                      </h2>
                      <p>
                        {filters.mode === "everyday"
                          ? `No collected cars currently have a confirmed route within four hours. ${unknown.length} classics are ready for travel-time review.`
                          : "Try broadening your filters or check source coverage for collection gaps."}
                      </p>
                      <button
                        className="button primary"
                        onClick={() => choose("unknown-route")}
                      >
                        Review unknown travel times <ArrowRight size={16} />
                      </button>
                      <button
                        className="text-link"
                        onClick={() => choose("regional")}
                      >
                        Browse the regional collection
                      </button>
                    </div>
                  )}
                  {view !== "map" && results.rows.length > 24 && (
                    <nav className="button-row" aria-label="Result pages">
                      <button
                        className="button secondary"
                        disabled={displayLimit <= 24}
                        onClick={() =>
                          setDisplayLimit((n) => Math.max(24, n - 24))
                        }
                      >
                        Previous 24
                      </button>
                      <span>
                        {displayLimit - 23}–
                        {Math.min(displayLimit, results.rows.length)} of{" "}
                        {results.rows.length}
                      </span>
                      <button
                        className="button secondary"
                        disabled={displayLimit >= results.rows.length}
                        onClick={() => setDisplayLimit((n) => n + 24)}
                      >
                        Next 24
                      </button>
                    </nav>
                  )}
                  <div className="results-foot">
                    <span>
                      Observed {fmtDate(data.generatedAt)} ·{" "}
                      {mode === "sample"
                        ? "Fictional demonstration"
                        : "Real source observations, not a completeness guarantee"}
                    </span>
                    <button onClick={() => setPage("coverage")}>
                      Where are these cars from? <ArrowUpRight size={13} />
                    </button>
                  </div>
                </section>
              </div>
            </>
          )}
          {page === "coverage" && (
            <>
              <PageHeading
                eyebrow="A CLEAR VIEW OF THE SEARCH"
                title="Coverage, without the guesswork."
                text="A blocked source is not zero inventory. Here is exactly what this collection can tell you."
              />
              <div className="stat-grid">
                {[
                  [
                    "Collected ads",
                    data.collectionCounts?.rawAds ?? data.listings.length,
                  ],
                  [
                    "Active ads",
                    data.listings.filter((l) => l.availability === "active")
                      .length,
                  ],
                  ["Classic targets", classics.length],
                  ["Within four hours", within.length],
                  ["Unknown travel time", unknown.length],
                ].map(([label, count]) => (
                  <div className="stat-card" key={label}>
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <div className="panel">
                <h2>How the shortlist gets smaller</h2>
                <div className="funnel">
                  {[
                    ["All collected", data.listings.length],
                    ["Models & years", classics.length],
                    [
                      "Route known",
                      classics.filter((l) =>
                        routeKnown(l, Date.now(), filters.routeMaxAgeDays),
                      ).length,
                    ],
                    ["≤ 240 minutes, active asks", within.length],
                    ["Current filters", results.rawCount],
                  ].map(([label, n]) => (
                    <div key={label}>
                      <span>{label}</span>
                      <strong>{n}</strong>
                    </div>
                  ))}
                </div>
                <div className="button-row">
                  <button
                    className="button secondary"
                    onClick={() => choose("unknown-route")}
                  >
                    Review unknown routes
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => choose("identity-review")}
                  >
                    Review identity
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => choose("nationwide")}
                  >
                    Expand nationwide
                  </button>
                </div>
              </div>
              <div className="panel">
                <div className="section-heading">
                  <h2>Source health & reach</h2>
                  <span>Snapshot {fmtDate(data.generatedAt)}</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Source / category</th>
                        <th>Status</th>
                        <th>Ads</th>
                        <th>Scope & limitations</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coverage.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <a href={c.url} target="_blank" rel="noreferrer">
                              {c.name}
                              <ArrowUpRight size={13} />
                            </a>
                            <small>{c.category}</small>
                          </td>
                          <td>
                            <span
                              className={`badge ${c.status === "partial" ? "amber" : ""}`}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td>{c.count ?? "—"}</td>
                          <td>
                            <strong>{c.scope}</strong>
                            <p>{c.note}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!data.coverage.length && (
                  <p>
                    Source research is in progress. No source has been counted
                    as searched.
                  </p>
                )}
              </div>
              <div className="panel">
                <h2>Run evidence</h2>
                {data.runs.length ? (
                  <div className="run-list">
                    {data.runs.slice(0, 30).map((r, i) => (
                      <div key={i}>
                        <strong>
                          {String(r.sourceId)} · {String(r.status)}
                        </strong>
                        <small>
                          {String(r.startedAt || "")} ·{" "}
                          {String(r.scope || "regional")}
                        </small>
                        <pre>{JSON.stringify(r.stats, null, 2)}</pre>
                        {!!r.error && <p>{String(r.error)}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No collector run records yet.</p>
                )}
              </div>
              <div className="notice-box">
                {data.limitations.map((l, i) => (
                  <p key={i}>{l}</p>
                ))}
              </div>
            </>
          )}
          {page === "compare" && (
            <>
              <PageHeading
                eyebrow="SIDE BY SIDE"
                title="Find what makes the difference."
                text="Compare up to six cars. Unknowns, bids, installed engines and original equipment stay distinct."
              />
              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={() =>
                    setWorkspace((w) => ({
                      ...w,
                      savedComparisons: [
                        ...w.savedComparisons,
                        {
                          name: `Comparison ${w.savedComparisons.length + 1}`,
                          ids: w.compare,
                        },
                      ],
                    }))
                  }
                  disabled={!compared.length}
                >
                  <Bookmark size={16} />
                  Save comparison
                </button>
                {workspace.savedComparisons.map((c, i) => (
                  <button
                    key={i}
                    className="button secondary"
                    onClick={() =>
                      setWorkspace((w) => ({ ...w, compare: c.ids }))
                    }
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {compared.length ? (
                <div className="panel compare-panel">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Specification</th>
                          {compared.map((l) => (
                            <th key={l.id}>
                              <Photo listing={l} />
                              <button onClick={() => setDetail(l)}>
                                {l.title}
                              </button>
                              <button
                                className="text-link"
                                onClick={() => compare(l.id)}
                              >
                                Remove
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          "Asking price",
                          "Current bid",
                          "Availability",
                          "Vehicle location",
                          "Driving estimate",
                          "Advertised year",
                          "Specialty evidence",
                          ...Object.values(specFields),
                        ].map((label, i) => {
                          const values = compared.map((l) =>
                            i === 0
                              ? money(l.askingPrice)
                              : i === 1
                                ? l.currentBid == null
                                  ? "Unknown"
                                  : money(l.currentBid)
                                : i === 2
                                  ? l.availability
                                  : i === 3
                                    ? l.vehicleLocation
                                      ? `${l.vehicleLocation.city}, ${l.vehicleLocation.state}`
                                      : "Unknown"
                                    : i === 4
                                      ? routeKnown(
                                          l,
                                          Date.now(),
                                          filters.routeMaxAgeDays,
                                        )
                                        ? `${Math.round(l.route!.minutes)} minutes`
                                        : "Unavailable"
                                      : i === 5
                                        ? l.advertisedYear || "Unknown"
                                        : i === 6
                                          ? l.specialtyEvidence
                                          : String(
                                              l.specs[
                                                Object.keys(specFields)[i - 7]
                                              ]?.value ?? "Unknown",
                                            ),
                          );
                          return (
                            <tr
                              key={label}
                              className={
                                new Set(values).size > 1 ? "difference" : ""
                              }
                            >
                              <th>{label}</th>
                              {values.map((v, j) => (
                                <td key={j}>{v}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <GitCompareArrows size={40} />
                  <h2>A closer look, side by side.</h2>
                  <p>Choose “Compare” on a car to start.</p>
                  <button
                    className="button primary"
                    onClick={() => choose("unknown-route")}
                  >
                    Explore cars
                  </button>
                </div>
              )}
            </>
          )}
          {page === "saved" && (
            <>
              <PageHeading
                eyebrow="KEEP THE GOOD SEARCHES"
                title="A search worth saving."
                text="Each search keeps its own scope, specialty settings and alert schedule. Existing searches keep their original defaults."
              />
              <div className="saved-grid">
                {workspace.searches.map((s) => (
                  <div className="panel" key={s.id}>
                    <div className="section-heading">
                      <Bookmark size={22} />
                      <button
                        className="icon-button"
                        aria-label={`Delete ${s.name}`}
                        onClick={() =>
                          setWorkspace((w) => ({
                            ...w,
                            searches: w.searches.filter((x) => x.id !== s.id),
                          }))
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <h2>{s.name}</h2>
                    <p>
                      {modeNames[s.filters.mode]} · {s.filters.minYear}–
                      {s.filters.maxYear}
                    </p>
                    <p>
                      {searchListings(data.listings, s.filters).rawCount}{" "}
                      matching ads · Specialty{" "}
                      {s.filters.specialty ? "included" : "off"}
                    </p>
                    <label className="field-label">
                      NEW MATCH ALERT POLICY
                    </label>
                    <select
                      aria-label={`Alert identity policy for ${s.name}`}
                      value={s.filters.alertPolicy}
                      onChange={(e) =>
                        setWorkspace((w) => ({
                          ...w,
                          searches: w.searches.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  filters: {
                                    ...x.filters,
                                    alertPolicy: e.target.value as
                                      "vehicle" | "ad",
                                  },
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      <option value="vehicle">
                        Vehicle group · avoid repeat crossposts
                      </option>
                      <option value="ad">Every newly matching source ad</option>
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        disabled={s.filters.alertPolicy === "ad"}
                        checked={s.filters.crosspostAlerts}
                        onChange={(e) =>
                          setWorkspace((w) => ({
                            ...w,
                            searches: w.searches.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    filters: {
                                      ...x.filters,
                                      crosspostAlerts: e.target.checked,
                                    },
                                  }
                                : x,
                            ),
                          }))
                        }
                      />
                      Also notify when a known vehicle gains another source
                    </label>
                    <label className="field-label">ALERT SCHEDULE</label>
                    <select
                      aria-label={`Alert schedule for ${s.name}`}
                      value={s.schedule}
                      onChange={(e) =>
                        setWorkspace((w) => ({
                          ...w,
                          searches: w.searches.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  schedule: e.target.value as
                                    "off" | "hourly" | "daily",
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      <option value="off">Off</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily digest</option>
                    </select>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={s.bidAlerts}
                        onChange={(e) =>
                          setWorkspace((w) => ({
                            ...w,
                            searches: w.searches.map((x) =>
                              x.id === s.id
                                ? { ...x, bidAlerts: e.target.checked }
                                : x,
                            ),
                          }))
                        }
                      />
                      Auction bid-change alerts
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={s.deadlineAlerts}
                        onChange={(e) =>
                          setWorkspace((w) => ({
                            ...w,
                            searches: w.searches.map((x) =>
                              x.id === s.id
                                ? { ...x, deadlineAlerts: e.target.checked }
                                : x,
                            ),
                          }))
                        }
                      />
                      Auction deadline alerts
                    </label>
                    <label className="field-label">DELIVERY</label>
                    <select
                      aria-label={`Delivery for ${s.name}`}
                      value={s.delivery}
                      onChange={(e) =>
                        setWorkspace((w) => ({
                          ...w,
                          searches: w.searches.map((x) =>
                            x.id === s.id
                              ? {
                                  ...x,
                                  delivery: e.target.value as
                                    "in-app" | "email" | "webhook",
                                }
                              : x,
                          ),
                        }))
                      }
                    >
                      <option value="in-app">In-app</option>
                      <option value="webhook">
                        Webhook · requires configuration
                      </option>
                      <option value="email">
                        Email · requires configuration
                      </option>
                    </select>
                    <div className="button-row">
                      <button
                        className="button primary"
                        onClick={() => {
                          setFilters(s.filters);
                          setPage("discover");
                        }}
                      >
                        Open search
                      </button>
                      <button
                        className="text-link"
                        onClick={() => {
                          setFilters(defaultSearch());
                          setPage("discover");
                          inform(
                            "Updated defaults loaded for preview. Save as a new search to adopt them.",
                          );
                        }}
                      >
                        Preview updated defaults
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {!workspace.searches.length && (
                <div className="empty-state">
                  <Bookmark size={38} />
                  <h2>Your best searches belong here.</h2>
                  <p>
                    Use “Save search” in Discover to keep a name, scope and
                    preferences.
                  </p>
                </div>
              )}
              <div className="panel">
                <h2>Alerts</h2>
                <p>
                  {mode === "connected"
                    ? "The local worker evaluates saved searches. First evaluation establishes a quiet baseline."
                    : "Connect the local backend to evaluate schedules. Static snapshots cannot collect or send alerts."}
                </p>
                {alerts.map((a) => (
                  <div className="alert-row" key={a.id}>
                    <Bell size={16} />
                    <span>{a.message}</span>
                    <small>{fmtDate(a.createdAt)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
          {page === "market" && (
            <>
              <PageHeading
                eyebrow="THE MARKET YOU CAN ACTUALLY SEE"
                title="A little perspective."
                text="Asking prices in this observed collection. These are not appraisals or completed transaction values."
              />
              <div className="stat-grid">
                {(["Mustang", "Camaro", "Corvette"] as const).map((m) => {
                  const asks = classics
                    .filter(
                      (l) =>
                        l.model === m &&
                        l.askingPrice != null &&
                        ["fixed", "negotiable"].includes(l.saleType) &&
                        l.availability === "active",
                    )
                    .map((l) => l.askingPrice!)
                    .sort((a, b) => a - b);
                  return (
                    <div className="stat-card" key={m}>
                      <span>
                        {m} · {asks.length} active asks
                      </span>
                      <strong>
                        {asks.length
                          ? money(
                              asks.length % 2
                                ? asks[Math.floor(asks.length / 2)]
                                : (asks[asks.length / 2 - 1] +
                                    asks[asks.length / 2]) /
                                    2,
                            )
                          : "—"}
                      </strong>
                      <small>Median asking price</small>
                    </div>
                  );
                })}
              </div>
              <div className="panel">
                <h2>Observed asking-price distribution</h2>
                {[
                  [0, 25000],
                  [25000, 50000],
                  [50000, 75000],
                  [75000, 100000],
                  [100000, Infinity],
                ].map(([lo, hi]) => {
                  const n = classics.filter(
                    (l) =>
                      l.availability === "active" &&
                      l.askingPrice != null &&
                      l.askingPrice >= lo &&
                      l.askingPrice < hi &&
                      ["fixed", "negotiable"].includes(l.saleType),
                  ).length;
                  return (
                    <div className="histogram-row" key={lo}>
                      <span>
                        {hi === Infinity
                          ? "$100k+"
                          : `${money(lo)}–${money(hi)}`}
                      </span>
                      <div>
                        <i
                          style={{
                            width: `${Math.max(n ? 1 : 0, (n / Math.max(classics.length, 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <strong>{n}</strong>
                    </div>
                  );
                })}
                <p className="field-help">
                  Bids, sold prices, financing payments and missing prices are
                  excluded. Cross-posts may affect ad-level counts.
                </p>
              </div>
              <div className="panel">
                <h2>Auction observations</h2>
                <p>
                  {data.listings.filter((l) => l.saleType === "auction").length}{" "}
                  auction ads in this collection. Auction bids and disclosed
                  fees are shown separately on the individual ad.
                </p>
                <button
                  className="button secondary"
                  onClick={() => choose("auctions")}
                >
                  Browse auctions <ArrowRight size={15} />
                </button>
              </div>
            </>
          )}
          {page === "settings" && (
            <>
              <PageHeading
                eyebrow="MAKE IT YOUR WORKSPACE"
                title="Your garage. Your settings."
                text="MuscleScout keeps its data, credentials and jobs independent from your other applications."
              />
              <div className="settings-grid">
                <div className="panel">
                  <h2>Connection mode</h2>
                  <label className="field-label">CURRENT WORKSPACE</label>
                  <select
                    aria-label="Connection mode"
                    value={mode}
                    onChange={(e) => {
                      if (e.target.value === "connected" && !token) {
                        inform("Enter your backend password below to connect.");
                        return;
                      }
                      setMode(e.target.value);
                    }}
                  >
                    <option value="snapshot">
                      Published snapshot · browser-local notes
                    </option>
                    {process.env.NODE_ENV === "development" && (
                      <option value="sample">
                        Sample · fictional examples
                      </option>
                    )}
                    <option value="connected">
                      Connected · local database
                    </option>
                  </select>
                  <p>
                    Each mode has its own shortlist, notes and searches.
                    Passwords are never saved in browser storage.
                  </p>
                  <label className="field-label">BACKEND URL</label>
                  <input
                    aria-label="Backend URL"
                    value={backendDraft}
                    disabled={connecting}
                    onChange={(e) => setBackendDraft(e.target.value)}
                  />
                  <label className="field-label">BACKEND PASSWORD</label>
                  <input
                    type="password"
                    autoComplete="current-password"
                    aria-label="Backend password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <div className="button-row">
                    <button
                      className="button primary"
                      onClick={connect}
                      disabled={connecting || !password}
                    >
                      {connecting ? "Connecting…" : "Connect locally"}
                      <ArrowRight size={16} />
                    </button>
                    {token && (
                      <button
                        className="button secondary"
                        onClick={() => {
                          api("/api/logout", {
                            method: "POST",
                            body: "{}",
                          }).catch(() => {});
                          setToken("");
                          sessionStorage.removeItem(
                            storageKey(base, "connection"),
                          );
                          sessionStorage.removeItem(
                            storageKey(base, "session", backend),
                          );
                          setMode("snapshot");
                        }}
                      >
                        Log out
                      </button>
                    )}
                  </div>
                  <p className="field-help">
                    HTTPS Pages may block HTTP or private-network connections.
                    Use the local website, or configure a reachable HTTPS
                    backend with an exact allowed origin.
                  </p>
                </div>
                <div className="panel">
                  <h2>Import & export</h2>
                  <button
                    className="button secondary"
                    onClick={() => setManualOpen(true)}
                  >
                    <Plus size={16} />
                    Add a manual listing
                  </button>
                  <p>
                    Merge a personal workspace or validated listing JSON.
                    Existing notes and inventory are preserved.
                  </p>
                  <div className="button-stack">
                    <button
                      className="button secondary"
                      onClick={() => {
                        setImportText("");
                        setImportOpen(true);
                      }}
                    >
                      <Upload size={16} />
                      Import JSON
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(
                          workspace,
                          "musclescout-private-workspace.json",
                        )
                      }
                    >
                      <Download size={16} />
                      Export private workspace
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        download(data.listings, "musclescout-listings.json")
                      }
                    >
                      <Download size={16} />
                      Export displayed listings
                    </button>
                  </div>
                  <p className="field-help">
                    Your workspace export includes private notes. Public
                    snapshots use a separate redacted backend export.
                  </p>
                </div>
                <div className="panel">
                  <h2>Collection & routing</h2>
                  <p>
                    Local collection is bounded and records partial runs.
                    Geocoding is explicit; road routing requires an
                    openrouteservice key in your backend environment.
                  </p>
                  <div className="button-row">
                    <button
                      className="button primary"
                      disabled={mode !== "connected" || busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await api("/api/collect", {
                            method: "POST",
                            body: JSON.stringify({
                              scope:
                                filters.mode === "nationwide"
                                  ? "nationwide"
                                  : "regional",
                            }),
                          });
                          inform(
                            "Collection queued. Check Source coverage for run progress.",
                          );
                        } catch (e) {
                          inform((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <RefreshCw size={16} />
                      Run collection
                    </button>
                    <button
                      className="button secondary"
                      onClick={() =>
                        refresh()
                          .then(() =>
                            inform(
                              "View refreshed. Cached observations retain their original date.",
                            ),
                          )
                          .catch((e) => inform(e.message))
                      }
                    >
                      Refresh view
                    </button>
                  </div>
                  <p className="field-help">
                    No routing key means drive time unavailable. No
                    miles-to-hours estimates are used.
                  </p>
                  {mode === "connected" && (
                    <SettingsEditor
                      settings={settings}
                      save={async (value, dryRun) => {
                        const r = await api("/api/settings", {
                          method: "PUT",
                          body: JSON.stringify({ settings: value, dryRun }),
                        });
                        if (!dryRun) setSettings(r.settings);
                        inform(
                          dryRun
                            ? "Configuration validated. No changes saved."
                            : "Settings saved. Existing searches keep their preferences.",
                        );
                      }}
                    />
                  )}
                </div>
                {mode === "connected" && (
                  <DeliveryAttempts
                    attempts={deliveries}
                    api={api}
                    refresh={refresh}
                  />
                )}
                <DuplicateReview
                  listings={data.listings}
                  connected={mode === "connected"}
                  api={api}
                  refreshed={refresh}
                />
                {mode === "connected" && (
                  <OperationsPanel
                    api={api}
                    onRefresh={refresh}
                    sources={data.coverage.map((c) => ({
                      id: c.id,
                      name: c.name,
                    }))}
                  />
                )}
                <div className="panel">
                  <h2>Privacy & provider notes</h2>
                  <p>
                    Tokens expire after eight hours. Remote content is displayed
                    as text, and listing links open the original source. Seller
                    claims remain claims.
                  </p>
                  <p>
                    Map data © OpenStreetMap contributors. Routing, when
                    configured: © openrouteservice by HeiGIT | Data from
                    OpenStreetMap.
                  </p>
                  <a
                    className="text-link"
                    href="https://operations.osmfoundation.org/policies/nominatim/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Geocoding usage policy <ExternalLink size={14} />
                  </a>
                  <p className="field-help">
                    Geocoding is a deliberate, cached, single-thread operation.
                    No autocomplete or automatic location enumeration.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        <footer className="app-footer">
          <span>
            MuscleScout <b>© 2026</b>
          </span>
          <span>A better search. A great next drive.</span>
          <button onClick={() => setPage("coverage")}>
            Built on visible evidence <ArrowUpRight size={12} />
          </button>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          {notice}
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Modal
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
        title={detail?.title || "Car details"}
        wide
      >
        {detail && (
          <>
            <div className="detail-grid">
              <div>
                <Photo listing={detail} large />
                {detail.photos.length > 1 && (
                  <div className="gallery">
                    {detail.photos.slice(1, 13).map((p, i) => (
                      <a href={p} key={i} target="_blank" rel="noreferrer">
                        <img
                          src={p}
                          alt={`${detail.title}, photo ${i + 2}`}
                          loading="lazy"
                        />
                      </a>
                    ))}
                  </div>
                )}
                <div className="detail-price">
                  <strong>
                    {detail.saleType === "auction"
                      ? money(detail.currentBid)
                      : money(detail.askingPrice)}
                  </strong>
                  <span>
                    {detail.saleType === "auction"
                      ? "Current bid · fees may apply"
                      : "Seller asking price"}
                  </span>
                </div>
                {detail.fieldEvidence?.askingPrice?.observedAt && (
                  <p className="field-help">
                    Price observed{" "}
                    {new Date(
                      detail.fieldEvidence.askingPrice.observedAt,
                    ).toLocaleDateString()}
                    . A later catalog check may not restate this price.
                  </p>
                )}
                <div className="button-row">
                  <a
                    className="button primary"
                    href={detail.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View original listing <ArrowUpRight size={16} />
                  </a>
                  <button
                    className="button secondary"
                    onClick={() => favorite(detail.id)}
                  >
                    <Heart size={16} />
                    {workspace.favorites.includes(detail.id)
                      ? "Shortlisted"
                      : "Shortlist"}
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => compare(detail.id)}
                  >
                    <GitCompareArrows size={16} />
                    Compare
                  </button>
                </div>
                <h3>Location & travel</h3>
                <p>
                  {detail.vehicleLocation
                    ? `${detail.vehicleLocation.city}, ${detail.vehicleLocation.state} · ${detail.vehicleLocation.precision} precision`
                    : "Actual vehicle location is unknown."}
                </p>
                <p>
                  {routeKnown(detail, Date.now(), filters.routeMaxAgeDays)
                    ? `Approximately ${Math.round(detail.route!.minutes)} minutes / ${Math.round(detail.route!.miles)} road miles. ${detail.route!.provider}, observed ${fmtDate(detail.route!.observedAt)}. ${detail.route!.traffic ? "Traffic included." : "Non-traffic baseline."}`
                    : detail.routeUnknownReason}
                </p>
                {detail.seller.location && (
                  <p>
                    Seller location: {detail.seller.location.city},{" "}
                    {detail.seller.location.state}
                  </p>
                )}
                {detail.vehicleLocation && (
                  <a
                    className="text-link"
                    href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(homeLabel)}&destination=${encodeURIComponent(`${detail.vehicleLocation.city}, ${detail.vehicleLocation.state}`)}&travelmode=driving`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Check the trip before traveling <ArrowUpRight size={14} />
                  </a>
                )}
                <h3>Source observation</h3>
                <p>{detail.description || "No description collected."}</p>
                {detail.originalSellerText && (
                  <>
                    <h3>Original seller wording · excerpt</h3>
                    <blockquote>{detail.originalSellerText}</blockquote>
                  </>
                )}
                <h3>Price & bid history</h3>
                {history.length ? (
                  <div className="history-list">
                    {history.map((h, i) => (
                      <div key={i}>
                        <span>
                          {fmtDate(h.observedAt)} · {h.kind}
                        </span>
                        <strong>
                          {h.amount == null ? "—" : money(h.amount)}
                        </strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>
                    First tracked {fmtDate(detail.firstSeenAt)}.{" "}
                    {mode === "connected"
                      ? "No additional price observations."
                      : "Connect to view the private observation history."}{" "}
                    This is not the seller’s first advertised date.
                  </p>
                )}
                <h3>All source ads in this vehicle group</h3>
                {data.listings
                  .filter(
                    (l) =>
                      l.id === detail.id ||
                      (!!detail.groupId && l.groupId === detail.groupId),
                  )
                  .map((l) => (
                    <p key={l.id}>
                      <a
                        className="text-link"
                        href={l.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {l.sourceName} ·{" "}
                        {l.saleType === "auction" ? "Bid" : "Ask"}{" "}
                        {money(
                          l.saleType === "auction"
                            ? l.currentBid
                            : l.askingPrice,
                        )}{" "}
                        <ArrowUpRight size={14} />
                      </a>
                    </p>
                  ))}
              </div>
              <div>
                <span className="badge">{detail.availability}</span>
                <h3>Identity & evidence</h3>
                <dl className="spec-list">
                  <dt>Advertised year</dt>
                  <dd>{detail.advertisedYear || "Unknown"}</dd>
                  <dt>Normalized year</dt>
                  <dd>{detail.year || "Review needed"}</dd>
                  <dt>Generation</dt>
                  <dd>{detail.generation || "Unknown"}</dd>
                  <dt>Specialty</dt>
                  <dd>{detail.specialty || "Not established"}</dd>
                  <dt>Specialty evidence</dt>
                  <dd>{detail.specialtyEvidence}</dd>
                  <dt>Authenticity</dt>
                  <dd>{detail.authenticity}</dd>
                  <dt>Seller</dt>
                  <dd>
                    {detail.seller.name} · {detail.seller.type}
                  </dd>
                  <dt>Stock number</dt>
                  <dd>{detail.stockNumber || "Not stated"}</dd>
                </dl>
                {detail.identityNotes.map((n, i) => (
                  <p className="notice-box" key={i}>
                    {n}
                  </p>
                ))}
                <h3>Advertised specifications</h3>
                <dl className="spec-list">
                  {Object.entries(detail.specs).map(([k, v]) => (
                    <div className="spec-entry" key={k}>
                      <dt>{specFields[k] || k}</dt>
                      <dd>
                        {String(v.value ?? "Unknown")}
                        <small>
                          {v.basis}
                          {v.note ? ` · ${v.note}` : ""}
                        </small>
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="field-help">
                  Unlisted specifications are unknown. Seller wording and
                  decoded identifiers do not establish physical authenticity.
                </p>
                <h3>Your private notes</h3>
                <textarea
                  aria-label="Private notes"
                  rows={5}
                  placeholder="What caught your eye? What would you ask?"
                  value={workspace.notes[detail.id] || ""}
                  onChange={(e) =>
                    setWorkspace((w) => ({
                      ...w,
                      notes: { ...w.notes, [detail.id]: e.target.value },
                    }))
                  }
                />
                <small className="field-help">
                  Saved in your{" "}
                  {mode === "connected"
                    ? "local database"
                    : "current browser workspace"}
                  .
                </small>
                <h3>Flag a data issue</h3>
                <input
                  aria-label="Data issue"
                  placeholder="Wrong location, uncertain year…"
                  value={workspace.flags[detail.id] || ""}
                  onChange={(e) =>
                    setWorkspace((w) => ({
                      ...w,
                      flags: { ...w.flags, [detail.id]: e.target.value },
                    }))
                  }
                />
                {mode === "connected" && (
                  <EvidenceTimeline
                    key={
                      "evidence:" +
                      detail.id +
                      (detail.userOverrides?.reviewedAt || "")
                    }
                    id={detail.id}
                    api={api}
                    changed={async () => {
                      await refresh();
                      const updated = await api<Snapshot>("/api/snapshot");
                      setDetail(
                        updated.listings.find((l) => l.id === detail.id) ||
                          null,
                      );
                    }}
                  />
                )}
                {mode === "connected" && (
                  <ReviewedData
                    key={
                      "editor:" +
                      detail.id +
                      (detail.userOverrides?.reviewedAt || "")
                    }
                    listing={detail}
                    save={async (patch) => {
                      const updated = await api<Listing>(
                        `/api/listings/${encodeURIComponent(detail.id)}/review`,
                        { method: "PATCH", body: JSON.stringify(patch) },
                      );
                      setDetail(updated);
                      await refresh();
                    }}
                  />
                )}
                <h3>Your reviewed correction</h3>
                <textarea
                  aria-label="Reviewed correction"
                  rows={3}
                  placeholder="Record your correction and supporting evidence. Seller data stays preserved."
                  value={workspace.corrections[detail.id]?.note || ""}
                  onChange={(e) =>
                    setWorkspace((w) => ({
                      ...w,
                      corrections: {
                        ...w.corrections,
                        [detail.id]: { note: e.target.value },
                      },
                    }))
                  }
                />
                <p className="field-help">
                  Observation: {fmtDate(detail.lastObservedAt)}
                  <br />
                  Network check: {fmtDate(detail.lastNetworkCheckedAt)}
                </p>
              </div>
            </div>
          </>
        )}
      </Modal>
      <Modal
        open={manualOpen}
        onOpenChange={setManualOpen}
        title="Add a manual listing"
      >
        <ManualEntry
          close={() => setManualOpen(false)}
          save={async (l) => {
            if (mode === "connected") {
              const r = await api("/api/import", {
                method: "POST",
                body: JSON.stringify({ listings: [l] }),
              });
              if (r.rejected.length) throw new Error(r.rejected[0].reason);
              await refresh();
            } else {
              const old: Listing[] = JSON.parse(
                localStorage.getItem(workspaceKey + ":inventory") || "[]",
              );
              localStorage.setItem(
                workspaceKey + ":inventory",
                JSON.stringify([...old, l]),
              );
              setData((d) => ({ ...d, listings: [...d.listings, l] }));
            }
            inform(
              "Manual listing saved. Review availability and location before travel.",
            );
          }}
        />
      </Modal>
      <Modal
        open={saveOpen}
        onOpenChange={setSaveOpen}
        title="Save this search"
      >
        <label className="field-label">SEARCH NAME</label>
        <input
          aria-label="Saved search name"
          value={saveName}
          onChange={(e) => setSaveName(e.target.value)}
        />
        <div className="notice-box">
          <strong>{results.rawCount} matching ads</strong>
          <p>
            {modeNames[filters.mode]} · {filters.minYear}–{filters.maxYear}
            <br />
            Specialty Mustangs {filters.specialty ? "on" : "off"} ·{" "}
            {filters.variants.join(", ")}
          </p>
        </div>
        <button
          className="button primary"
          disabled={!saveName.trim()}
          onClick={() => {
            setWorkspace((w) => ({
              ...w,
              searches: [
                ...w.searches,
                {
                  id: crypto.randomUUID(),
                  name: saveName.trim(),
                  filters: { ...filters },
                  defaultsVersion: 1,
                  schedule: "daily",
                  delivery: "in-app",
                  bidAlerts: false,
                  deadlineAlerts: false,
                },
              ],
            }));
            setSaveOpen(false);
            inform("Search saved with its own preferences.");
          }}
        >
          Save search <Check size={16} />
        </button>
      </Modal>
      <Modal
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import into MuscleScout"
      >
        <p>
          Paste a canonical listing array or exported workspace. Imports merge
          and preserve existing personal state.
        </p>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Choose JSON import file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5e6) {
                inform("Import limit is 5 MB.");
                return;
              }
              setImportText(await f.text());
            }
          }}
        />
        <textarea
          aria-label="Import JSON"
          rows={10}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder='{"favorites": [], "notes": {}}'
        />
        <button className="button primary" onClick={importData}>
          Validate & merge import <Upload size={16} />
        </button>
      </Modal>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
function RuleBuilder({ add }: { add: (r: Search["rules"][number]) => void }) {
  const [field, setField] = useState("specs.bodyStyle"),
    [operator, setOperator] =
      useState<Search["rules"][number]["operator"]>("include"),
    [value, setValue] = useState("");
  return (
    <div className="rule-builder">
      <select
        aria-label="Additional filter field"
        value={field}
        onChange={(e) => setField(e.target.value)}
      >
        {Object.entries(specFields).map(([k, v]) => (
          <option key={k} value={`specs.${k}`}>
            {v}
          </option>
        ))}
        <option value="trim">Trim</option>
        <option value="authenticity">Authenticity</option>
        <option value="sourceId">Source</option>
      </select>
      <select
        aria-label="Additional filter operator"
        value={operator}
        onChange={(e) => setOperator(e.target.value as typeof operator)}
      >
        {["include", "exclude", "known", "unknown", "min", "max"].map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      {!["known", "unknown"].includes(operator) && (
        <input
          aria-label="Additional filter value"
          placeholder="Value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
      <button
        className="button secondary"
        onClick={() => {
          add({
            field,
            operator,
            ...(!["known", "unknown"].includes(operator)
              ? {
                  value: ["min", "max"].includes(operator)
                    ? Number(value)
                    : value,
                }
              : {}),
          });
          setValue("");
        }}
        disabled={!["known", "unknown"].includes(operator) && !value}
      >
        Add filter <Plus size={14} />
      </button>
    </div>
  );
}
function SettingsEditor({
  settings,
  save,
}: {
  settings: Record<string, unknown>;
  save: (s: Record<string, unknown>, dryRun: boolean) => Promise<void>;
}) {
  const [text, setText] = useState(JSON.stringify(settings, null, 2)),
    [error, setError] = useState("");
  useEffect(() => setText(JSON.stringify(settings, null, 2)), [settings]);
  return (
    <details>
      <summary>Provider & collection configuration</summary>
      <textarea
        aria-label="Backend settings JSON"
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="button-row">
        {[true, false].map((dry) => (
          <button
            key={String(dry)}
            className="button secondary"
            onClick={() => {
              try {
                save(JSON.parse(text), dry).catch((e) => setError(e.message));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {dry ? "Validate dry run" : "Save settings"}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
