"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Crosshair, Plus, Trash2 } from "lucide-react";
import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAX_TERRITORIES, type Territory } from "@leadgen/core/booking/config";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Coverage Area: a map of circles, one per territory. Drag a circle to move
// it, drag the handle on its edge to resize it. The first is the default
// territory; others suit crews working different patches.

const METRES_PER_MILE = 1609.344;
const MIN_MILES = 1;
const MAX_MILES = 100;
const COLOURS = ["#2563eb", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2"];

const clamp = (n: number) => Math.min(MAX_MILES, Math.max(MIN_MILES, Math.round(n)));
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const colour = (index: number) => COLOURS[index % COLOURS.length];

type Leaflet = typeof import("leaflet");
type Layers = { circle: Circle; centre: Marker; handle: Marker };

// The point `miles` due east of a centre, where the resize handle sits.
function edgePoint(t: Pick<Territory, "lat" | "lng">, miles: number): [number, number] {
  const R = 3958.8;
  const lat = (t.lat * Math.PI) / 180;
  const dLng = Math.acos((Math.cos(miles / R) - Math.sin(lat) ** 2) / Math.cos(lat) ** 2);
  return [t.lat, t.lng + (dLng * 180) / Math.PI];
}

function handleIcon(L: Leaflet, colour: string, readOnly: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#fff;border:3px solid ${colour};box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:${readOnly ? "default" : "ew-resize"}"></div>`,
  });
}

function centreIcon(L: Leaflet, colour: string, readOnly: boolean) {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<div style="width:22px;height:22px;border-radius:9999px;background:${colour};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:${readOnly ? "default" : "move"}"></div>`,
  });
}

export function CoverageMap({
  initial,
  postcode,
  readOnly,
  action,
}: {
  initial: Territory[];
  postcode: string;
  readOnly: boolean;
  action: (territories: Territory[]) => Promise<SaveState>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [territories, setTerritories] = useState<Territory[]>(initial);
  const [savedJson, setSavedJson] = useState(JSON.stringify(initial));
  const [state, setState] = useState<SaveState>({});
  const [pending, startTransition] = useTransition();
  const [mapFailed, setMapFailed] = useState(false);
  const [ready, setReady] = useState(false);

  // Map objects live outside React; the effect below keeps them matching `territories`.
  const L = useRef<Leaflet | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const layers = useRef(new Map<string, Layers>());
  const latest = useRef(territories);
  const dragging = useRef<string | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    latest.current = territories;
  }, [territories]);

  function update(id: string, patch: Partial<Territory>) {
    setTerritories((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setState({});
  }

  function fitTo(ids: string[]) {
    const group = ids.map((id) => layers.current.get(id)?.circle).filter((c) => c !== undefined);
    if (!L.current || !map.current || group.length === 0) return;
    map.current.fitBounds(L.current.featureGroup(group).getBounds(), { padding: [30, 30] });
  }

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const known = layers.current;

    import("leaflet")
      .then((mod) => {
        // Leaflet is a UMD bundle, so depending on the bundler its API is on the module or on `default`.
        const lib = "map" in mod ? mod : (mod as unknown as { default: typeof mod }).default;
        if (cancelled || !container.current) return;
        const m = lib.map(container.current, { scrollWheelZoom: false });
        // A circle can't measure its bounds until the map has a view; fitting refines this.
        m.setView([latest.current[0].lat, latest.current[0].lng], 10);
        lib
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          })
          .addTo(m);
        L.current = lib;
        map.current = m;
        setReady(true);
      })
      .catch((error) => {
        console.error("Coverage map failed to load", error);
        setMapFailed(true);
      });

    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      L.current = null;
      known.clear();
      fitted.current = false;
      setReady(false);
    };
  }, []);

  // Add, move and remove circles to match the territories.
  useEffect(() => {
    const lib = L.current;
    const m = map.current;
    if (!ready || !lib || !m) return;
    const known = layers.current;

    for (const [id, l] of known) {
      if (territories.some((t) => t.id === id)) continue;
      l.circle.remove();
      l.centre.remove();
      l.handle.remove();
      known.delete(id);
    }

    let added = false;
    territories.forEach((t, index) => {
      const col = colour(index);
      let l = known.get(t.id);
      if (!l) {
        added = true;
        const circle = lib.circle([t.lat, t.lng], {
          radius: t.radius_miles * METRES_PER_MILE,
          color: col,
          weight: 2,
          fillColor: col,
          fillOpacity: 0.12,
          interactive: false,
        });
        const centre = lib.marker([t.lat, t.lng], {
          draggable: !readOnly,
          keyboard: false,
          title: readOnly ? t.name : `Drag to move ${t.name}`,
          icon: centreIcon(lib, col, readOnly),
          zIndexOffset: 500,
        });
        const handle = lib.marker(edgePoint(t, t.radius_miles), {
          draggable: !readOnly,
          keyboard: false,
          title: readOnly ? `${t.name} edge` : `Drag to resize ${t.name}`,
          icon: handleIcon(lib, col, readOnly),
          zIndexOffset: 1000,
        });
        circle.addTo(m);
        centre.addTo(m);
        handle.addTo(m);

        // Moving the circle: the whole territory follows the dot.
        centre.on("dragstart", () => (dragging.current = t.id));
        centre.on("drag", () => {
          const { lat, lng } = centre.getLatLng();
          update(t.id, { lat: round5(lat), lng: round5(lng) });
        });
        centre.on("dragend", () => (dragging.current = null));

        // Resizing: the circle follows the handle, snapping to whole miles on release.
        handle.on("dragstart", () => (dragging.current = t.id));
        handle.on("drag", () => {
          const current = latest.current.find((x) => x.id === t.id);
          if (!current) return;
          const miles = clamp(m.distance([current.lat, current.lng], handle.getLatLng()) / METRES_PER_MILE);
          update(t.id, { radius_miles: miles });
        });
        handle.on("dragend", () => {
          dragging.current = null;
          const current = latest.current.find((x) => x.id === t.id);
          if (current) handle.setLatLng(edgePoint(current, current.radius_miles));
        });

        l = { circle, centre, handle };
        known.set(t.id, l);
      }

      l.circle.setLatLng([t.lat, t.lng]);
      l.circle.setRadius(t.radius_miles * METRES_PER_MILE);
      // Don't fight the pointer: skip whichever marker is being dragged.
      if (dragging.current !== t.id) {
        l.centre.setLatLng([t.lat, t.lng]);
        l.handle.setLatLng(edgePoint(t, t.radius_miles));
      } else {
        l.handle.setLatLng(edgePoint(t, t.radius_miles));
      }
    });

    if (!fitted.current) {
      fitted.current = true;
      fitTo(territories.map((t) => t.id));
    } else if (added) {
      fitTo([territories[territories.length - 1].id]);
    }
  }, [territories, ready, readOnly]);

  const dirty = JSON.stringify(territories) !== savedJson;

  function addTerritory() {
    // Starts at the middle of what's on screen, so it's easy to find.
    const centre = map.current?.getCenter();
    const base = territories[0];
    const n = territories.length + 1;
    const t: Territory = {
      id: crypto.randomUUID().slice(0, 8),
      name: `Territory ${n}`,
      lat: round5(centre?.lat ?? base.lat),
      lng: round5(centre?.lng ?? base.lng),
      radius_miles: 10,
    };
    setTerritories((all) => [...all, t]);
    setState({});
  }

  return (
    <div className="grid gap-4">
      <div className="relative overflow-hidden rounded-xl border">
        <div
          ref={container}
          className="h-112 w-full bg-muted"
          role="application"
          aria-label={`Map of your coverage areas around ${postcode}`}
        />
        {mapFailed && (
          <p className="absolute inset-0 grid place-items-center bg-muted p-6 text-center text-sm text-muted-foreground">
            The map couldn&apos;t load. You can still set the distances below.
          </p>
        )}
      </div>

      <ul className="grid gap-2">
        {territories.map((t, index) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3">
            <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: colour(index) }} />
            <Input
              aria-label="Territory name"
              className="w-52"
              value={t.name}
              disabled={readOnly || pending}
              maxLength={60}
              onChange={(e) => update(t.id, { name: e.target.value })}
            />
            <div className="flex items-center gap-3">
              <input
                type="range"
                aria-label={`${t.name} radius in miles`}
                min={MIN_MILES}
                max={MAX_MILES}
                value={Math.min(t.radius_miles, MAX_MILES)}
                disabled={readOnly || pending}
                onChange={(e) => update(t.id, { radius_miles: clamp(Number(e.target.value)) })}
                className="w-36 accent-primary"
              />
              <Input
                aria-label={`${t.name} miles`}
                inputMode="numeric"
                className="w-16"
                value={t.radius_miles}
                disabled={readOnly || pending}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  if (n) update(t.id, { radius_miles: clamp(n) });
                }}
              />
              <span className="text-sm text-muted-foreground">miles</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => fitTo([t.id])}>
                <Crosshair /> Show
              </Button>
              {!readOnly && index > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => {
                    setTerritories((all) => all.filter((x) => x.id !== t.id));
                    setState({});
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" disabled={pending || territories.length >= MAX_TERRITORIES} onClick={addTerritory}>
            <Plus /> Add a territory
          </Button>
          <Button
            disabled={!dirty || pending}
            onClick={() =>
              startTransition(async () => {
                const result = await action(territories.map((t) => ({ ...t, name: t.name.trim() })));
                setState(result);
                if (result.saved) setSavedJson(JSON.stringify(territories));
              })
            }
          >
            {pending ? "Saving…" : "Save coverage"}
          </Button>
          <p role="status" className="text-sm">
            {state.message ? (
              <span className="text-destructive">{state.message}</span>
            ) : state.saved && !dirty ? (
              <span className="text-muted-foreground">Saved. Customers see this now.</span>
            ) : dirty ? (
              <span className="text-muted-foreground">Not saved yet.</span>
            ) : null}
          </p>
        </div>
      )}
    </div>
  );
}
