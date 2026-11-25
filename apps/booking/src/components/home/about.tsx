import { aboutHeading, aboutParagraphs, type About } from "@leadgen/core/branding/about";
import { cn } from "@/lib/cn";
import { container } from "@/components/site";

// Who's behind the business, in their own words, with their photo
// (Settings → Booking page → About you). Shown once there's a story.
export function AboutSection({ about, businessName }: { about: About; businessName: string }) {
  const paragraphs = aboutParagraphs(about.text);
  if (!paragraphs.length) return null;
  const photo = about.photo_url;
  const name = about.name?.trim();

  return (
    <section aria-labelledby="about-title" className="py-14 sm:py-20">
      <div
        className={cn(
          container,
          "grid gap-10",
          photo && "md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center md:gap-14",
        )}
      >
        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={name ? `${name}, ${businessName}` : businessName}
            loading="lazy"
            className="aspect-4/5 w-full max-w-sm rounded-2xl object-cover md:max-w-none"
          />
        )}
        <div className="grid max-w-2xl content-start gap-5">
          <h2 id="about-title" className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {aboutHeading(about, businessName)}
          </h2>
          <div className="grid gap-4 text-lg/relaxed text-pretty whitespace-pre-line text-neutral-700">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {name && (
            <p className="border-l-2 border-brand pl-4">
              <span className="block font-heading text-lg font-semibold text-neutral-900">{name}</span>
              <span className="text-sm text-neutral-500">{businessName}</span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
