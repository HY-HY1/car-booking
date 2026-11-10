export function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">{children}</section>;
}
