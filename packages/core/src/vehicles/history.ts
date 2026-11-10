// A customer's jobs, car by car. Every booking made by hand or online stores
// its own copy of the car, so the same car is matched back together by its
// registration, or by make and model when there isn't one. No database access.

type Car = { make: string | null; model: string | null; registration: string | null };

export type HistoryJob = {
  id: string;
  starts_at: string;
  status: string;
  price_pence: number;
  serviceName: string | null;
  vehicle: Car | null;
  extras: Car[];
};

export type CarHistory = { key: string; label: string; registration: string | null; jobs: HistoryJob[] };

const keyOf = (car: Car) => {
  const reg = car.registration?.replace(/\s/g, "").toUpperCase();
  if (reg) return `reg:${reg}`;
  const name = [car.make, car.model].filter(Boolean).join(" ").toLowerCase();
  return name ? `car:${name}` : null;
};

// Cars with the most recent job first, and each car's jobs newest first.
export function vehicleHistory(jobs: HistoryJob[]): CarHistory[] {
  const cars = new Map<string, CarHistory>();
  const newestFirst = [...jobs].sort((a, b) => b.starts_at.localeCompare(a.starts_at));

  for (const job of newestFirst) {
    for (const car of [job.vehicle, ...job.extras]) {
      if (!car) continue;
      const key = keyOf(car);
      if (!key) continue;
      const entry = cars.get(key) ?? {
        key,
        label: [car.make, car.model].filter(Boolean).join(" ") || car.registration || "Car",
        registration: car.registration,
        jobs: [],
      };
      if (!entry.jobs.some((j) => j.id === job.id)) entry.jobs.push(job);
      cars.set(key, entry);
    }
  }
  return [...cars.values()];
}
