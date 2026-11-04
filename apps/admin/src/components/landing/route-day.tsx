// A made-up van's day, as the route planner lays it out. No real places or
// postcodes. Full width; scrolls sideways on a phone.
const ROUTE = [
  { kind: "home", time: "08:05", title: "Leave base", place: "Your start point" },
  { kind: "drive", text: "15 min drive" },
  { kind: "job", time: "08:30–11:00", title: "Full valet", place: "Ford Focus · 6 miles" },
  { kind: "drive", text: "Leave by 11:16 · 16 min spare · 19 min drive" },
  { kind: "job", time: "11:45–13:15", title: "Mini valet", place: "VW Polo · 7 miles" },
  { kind: "drive", text: "Leave by 13:41 · 26 min spare · 24 min drive" },
  { kind: "job", time: "14:15–17:00", title: "Enhancement", place: "BMW X5 · 9 miles" },
  { kind: "drive", text: "22 min drive" },
  { kind: "home", time: "17:22", title: "Back at base", place: "Your start point" },
] as const;

export function RouteDay() {
  return (
    <>
      <div className="overflow-x-auto border-y border-(--rule-dark) [scrollbar-width:thin]">
        <ol className="flex w-max snap-x snap-mandatory items-stretch px-4 sm:px-6 lg:w-full lg:min-w-max lg:justify-center">
          {ROUTE.map((stop, i) =>
            stop.kind === "drive" ? (
              <li key={i} className="flex w-36 shrink-0 flex-col justify-center px-3 py-8 lg:w-32">
                <span aria-hidden className="block h-px w-full bg-[repeating-linear-gradient(90deg,var(--hi)_0_6px,transparent_6px_12px)]" />
                <span className="lp-data mt-3 text-[11px] leading-snug text-(--mist)">{stop.text}</span>
              </li>
            ) : (
              <li
                key={i}
                className={`flex shrink-0 snap-start flex-col justify-center border-x border-(--rule-dark) px-5 py-8 ${stop.kind === "home" ? "w-36 bg-[#181b18]" : "w-52 lg:w-48"}`}
              >
                <span className="lp-data text-xl whitespace-nowrap text-(--paper) xl:text-2xl">{stop.time}</span>
                <span className="mt-2 font-semibold">{stop.title}</span>
                <span className="text-sm text-(--mist)">{stop.place}</span>
              </li>
            ),
          )}
        </ol>
      </div>
      <p className="lp-data mx-auto mt-6 max-w-7xl px-4 text-xs text-(--mist) sm:px-6">
        An example day for one van · aims to get you there 10 minutes early · turns red if a job can&apos;t be reached in
        time · one tap to navigate
      </p>
    </>
  );
}
