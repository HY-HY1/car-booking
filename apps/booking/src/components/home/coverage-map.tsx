"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { CoverageCircle } from "@leadgen/core/booking/engine";

// The area a business covers, as circles on a map. Look only: the circles
// take the brand colour from the page (globals.css, .coverage-circle), so they
// follow light and dark mode.

const METRES_PER_MILE = 1609.344;

export function CoverageMap({ circles, label }: { circles: CoverageCircle[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    import("leaflet")
      .then((mod) => {
        // A UMD bundle: depending on the bundler, the API is on the module or on `default`.
        const L = "map" in mod ? mod : (mod as unknown as { default: typeof mod }).default;
        if (cancelled || !container.current) return;
        map = L.map(container.current, { scrollWheelZoom: false, zoomSnap: 0.5 });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        const shapes = circles.map((c) =>
          L.circle([c.lat, c.lng], { radius: c.miles * METRES_PER_MILE, className: "coverage-circle", interactive: false }).addTo(map!),
        );
        // A circle can't measure itself until the map has a view.
        map.setView([circles[0].lat, circles[0].lng], 10);
        map.fitBounds(L.featureGroup(shapes).getBounds(), { padding: [24, 24] });
      })
      .catch((error) => {
        console.error("Coverage map failed to load", error);
        setFailed(true);
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [circles]);

  return (
    <div className="coverage-map relative isolate overflow-hidden rounded-2xl border bg-neutral-100 shadow-sm">
      <div ref={container} role="img" aria-label={label} className="aspect-4/3 w-full sm:aspect-auto sm:h-96" />
      {failed && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-500">The map couldn&apos;t load.</p>
      )}
    </div>
  );
}
