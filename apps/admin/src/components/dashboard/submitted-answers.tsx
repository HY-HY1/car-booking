import type { SubmittedGroup } from "@/lib/booking-display";

// Everything the customer typed or ticked on the booking page, in groups.
export function SubmittedAnswers({ groups }: { groups: SubmittedGroup[] }) {
  if (groups.length === 0) return <p className="text-muted-foreground">Nothing else was submitted.</p>;
  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {groups.map((g) => (
        <section key={g.title} className="grid content-start gap-1.5">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{g.title}</h3>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
            {g.rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
