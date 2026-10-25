import type { Metadata } from "next";
import Link from "next/link";
import { formatDuration, formatPence, SIZE_CLASSES, type SizeClass } from "@leadgen/core/booking/config";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { exampleAddOn, exampleQuote, exampleService, exampleSettings, exampleTiers } from "@/lib/docs-examples";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Packages and pricing" };

export default function Pricing() {
  const quote = exampleQuote();
  const heavy = exampleTiers.find((t) => t.key === "heavy")!;
  const large = exampleService.size_adjustments.large!;
  const deposit = exampleSettings.deposit;

  return (
    <>
      <DocTitle eyebrow="How it works" title="Packages and pricing">
        <p>
          You set the rules once, and every quote is worked out from them, whether it&apos;s on your booking page, on
          your website or in the dashboard. Customers never type a price in.
        </p>
      </DocTitle>

      <p>
        Everything on this page lives under <Place>Packages</Place> in the dashboard. Only the business owner can change
        prices.
      </p>

      <h2>Services</h2>
      <p>A service (or package) is something a customer can book. Each one has:</p>
      <ul>
        <li>
          a <strong>name</strong>, a <strong>base price</strong> and how long it <strong>takes</strong>
        </li>
        <li>
          <strong>where</strong> it can be done: at the customer&apos;s address, at your unit, or both
        </li>
        <li>
          <strong>size adjustments</strong>: an extra price and extra time for bigger vehicles
        </li>
        <li>
          its <strong>page content</strong>: tagline, photos, what&apos;s included and not included, the steps you
          follow, FAQs and search-engine title and description
        </li>
      </ul>
      <p>
        Services can be switched off without deleting them. Switched-off services disappear from your booking page and
        from the API.
      </p>

      <h3>Vehicle sizes</h3>
      <p>Customers pick a size, and it&apos;s suggested from the make and model they choose. The sizes are:</p>
      <SimpleTable
        head={["Size", "Examples"]}
        rows={(Object.keys(SIZE_CLASSES) as SizeClass[]).map((size) => {
          const [name, examples] = SIZE_CLASSES[size].split(": ");
          return [name, examples];
        })}
      />
      <p>
        A size with no adjustment costs the base price. You only need to set the sizes that cost more or take longer.
      </p>

      <h2>Extras (add-ons)</h2>
      <p>
        Extras are added on top of a service, each with its own price and time. An extra can go with every service, or
        only with the ones you pick.
      </p>

      <h2>Condition levels</h2>
      <p>
        Condition levels let you charge more for a car in a worse state. Each level has a name and description, a{" "}
        <strong>multiplier</strong> and optional <strong>extra time</strong>.
      </p>
      <p>
        Customers don&apos;t choose a level: nobody picks the option that costs more. Instead, the photos they add while
        booking are checked by AI against your levels, and the price updates before they pay. Write each level as
        &quot;Name: what it looks like&quot;, for example <em>Heavy: pet hair, stains, mud</em>, because the
        description is what the photos are judged against.
      </p>
      <ul>
        <li>
          The multiplier applies to the service and size price, not to extras. A multiplier of 1.25 adds a quarter.
        </li>
        <li>The extra is rounded to the nearest pound, so quotes look like prices you&apos;d say out loud.</li>
        <li>
          Mark a level <strong>needs inspection</strong> when you can&apos;t price it without seeing the car. It&apos;s
          booked at the normal price and flagged for you to confirm.
        </li>
        <li>
          <strong>No photos</strong>, or photos that don&apos;t show enough, means no condition uplift. The booking is
          marked for you to check the car and confirm the price on the day.
        </li>
      </ul>
      <p>
        On each booking and lead you can see the level the photos gave, how sure the check was, and a short note on
        what it saw.
      </p>

      <h2>Call-out fee, minimum charge and deposit</h2>
      <SimpleTable
        head={["Setting", "What it does"]}
        rows={[
          ["Mobile call-out fee", "Added to every job at the customer's address. Not added to jobs at your unit."],
          ["Minimum charge", "If a quote comes to less than this, it's topped up to it, shown as its own line."],
          [
            "Deposit",
            <>
              None, a percentage of the total, or a fixed amount (never more than the total). Taken by card when they
              book, if Stripe is connected. See <Link href={docsUrl("/payments")}>Deposits and payments</Link>.
            </>,
          ],
        ]}
      />

      <h2 id="example">A worked example</h2>
      <p>Say your rules are:</p>
      <ul>
        <li>
          {exampleService.name}: {formatPence(exampleService.base_price_pence)},{" "}
          {formatDuration(exampleService.duration_mins)}. Large cars add {formatPence(large.price_pence)} and{" "}
          {large.extra_mins} minutes.
        </li>
        <li>
          Condition &quot;{heavy.label.split(":")[0]}&quot;: multiplier {heavy.multiplier}, plus {heavy.extra_mins}{" "}
          minutes.
        </li>
        <li>
          {exampleAddOn.name}: {formatPence(exampleAddOn.price_pence)}, {exampleAddOn.duration_mins} minutes.
        </li>
        <li>
          Mobile call-out fee {formatPence(exampleSettings.mobile_surcharge_pence)}, minimum charge{" "}
          {formatPence(exampleSettings.min_price_pence)}
          {deposit.type === "percent" && `, deposit ${deposit.value}%`}.
        </li>
      </ul>
      <p>
        A customer books a {exampleService.name.toLowerCase()} for a large car whose photos show heavy condition, with{" "}
        {exampleAddOn.name.toLowerCase()}, at their address. Their quote:
      </p>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            {quote.lines.map((line) => (
              <tr key={line.label}>
                <td className="px-3 py-2">{line.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPence(line.amount_pence)}</td>
              </tr>
            ))}
            <tr className="bg-muted/40 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPence(quote.total_pence)}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted-foreground">Deposit due when booking</td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                {formatPence(quote.deposit_pence)}
              </td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-muted-foreground">Time booked out</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{formatDuration(quote.duration_mins)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        The condition line is {Math.round((heavy.multiplier - 1) * 100)}% of the service and size price (
        {formatPence(exampleService.base_price_pence + large.price_pence)}), rounded to the pound. It doesn&apos;t
        touch the {exampleAddOn.name.toLowerCase()}.
      </p>
      <Callout>
        <p>
          This example is worked out by the same code your booking page uses, so it&apos;s always exactly what a
          customer would see.
        </p>
      </Callout>

      <h2>The order things are added</h2>
      <ol>
        <li>The service&apos;s base price and time.</li>
        <li>The size adjustment for their vehicle.</li>
        <li>The condition level, applied to the two above.</li>
        <li>Each extra they chose.</li>
        <li>The call-out fee, for mobile jobs.</li>
        <li>A top-up to your minimum charge, if the total is below it.</li>
        <li>The deposit, worked out from the final total.</li>
      </ol>
      <p>
        The time is added up the same way, and that&apos;s how long the job is booked out in your diary. Travel time is
        on top. See <Link href={docsUrl("/availability")}>Hours, vans and travel</Link>.
      </p>
    </>
  );
}
