import { connection } from "next/server";
import { SaveFormDefaults } from "@/components/dashboard/form-kit";
import { PageHeader } from "@/components/dashboard/page-header";
import { requireAccess } from "@/lib/auth";

// The booking page: everything about the business's customer-facing site
// (its look, the home page's sections, search and sharing, its address and
// adding it to their own website). Substantial enough to be its own page in
// the sidebar rather than a Settings tab. A menu down the side jumps to each
// section (a row across the top on a phone); forms only offer Save once
// something has changed, as in Settings.

// In the order the page shows them (page.tsx).
const SECTIONS = [
  { id: "look", label: "Look and feel" },
  { id: "about", label: "About you" },
  { id: "photos", label: "Photos of your work" },
  { id: "videos", label: "Videos" },
  { id: "faqs", label: "Questions and answers" },
  { id: "home", label: "Home page" },
  { id: "trust", label: "Trust and enquiries" },
  { id: "search", label: "Search and sharing" },
  { id: "address", label: "Web address" },
  { id: "embed", label: "Add to your website" },
];

export default async function BookingPageLayout({ children, params }: LayoutProps<"/app/[tenant]/booking-page">) {
  // Per signed-in user, and the sign-in check reads the clock (session
  // expiry), so render at request time, never ahead.
  await connection();
  const { tenant: slug } = await params;
  await requireAccess(slug, "settings.view");
  return (
    <SaveFormDefaults requireChanges footer>
      <PageHeader
        title="Booking page"
        description="Your customer-facing site: how it looks, what its home page shows, how it appears in search, and where it lives."
      />
      <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:gap-x-10">
        <nav aria-label="Booking page sections" className="-mx-4 overflow-x-auto px-4 lg:sticky lg:top-4 lg:mx-0 lg:self-start lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <a
                  href={`#${s.id}`}
                  className="block rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="@container min-w-0 max-w-6xl">{children}</div>
      </div>
    </SaveFormDefaults>
  );
}
