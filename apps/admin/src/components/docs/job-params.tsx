import Link from "next/link";
import { SIZE_CLASSES } from "@leadgen/core/booking/config";
import type { Param } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

// The job parameters, shared with the availability page.
export function jobParams(): Param[] {
  const sizes = Object.keys(SIZE_CLASSES);
  return [
    {
      name: "serviceId",
      type: "string",
      required: true,
      text: (
        <>
          A service&apos;s <code>id</code> from <Link href={docsUrl("/api/catalog")}>the catalogue</Link>.
        </>
      ),
    },
    {
      name: "sizeClass",
      type: "string",
      required: true,
      text: (
        <>
          The vehicle&apos;s size: {sizes.map((s, i) => (
            <span key={s}>
              {i > 0 && ", "}
              <code>{s}</code>
            </span>
          ))}
          . The catalogue&apos;s <code>price.bySize[].label</code> describes each one.
        </>
      ),
    },
    {
      name: "locationType",
      type: "string",
      required: true,
      text: (
        <>
          <code>mobile</code> (at the customer&apos;s address) or <code>unit</code> (dropped off). Must be one of the
          service&apos;s <code>locations</code>.
        </>
      ),
    },
    {
      name: "addOnIds",
      type: "string",
      text: "Extras' ids from the catalogue, separated by commas. Up to 20.",
    },
    {
      name: "postcode",
      type: "string",
      text: "Where the car will be, as a full UK postcode. Adds any travel fee to a mobile job.",
    },
  ];
}
