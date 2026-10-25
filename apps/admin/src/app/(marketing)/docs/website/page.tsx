import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Place, SimpleTable } from "@/components/docs/docs-kit";
import { EXAMPLE_BOOKING_URL, exampleService } from "@/lib/docs-examples";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Your website and booking link" };

export default function Website() {
  const site = EXAMPLE_BOOKING_URL;

  return (
    <>
      <DocTitle eyebrow="How it works" title="Your website and booking link">
        <p>
          Three ways to get customers booking: a link you share anywhere, a button on your own website, and the API
          for showing your services and prices on your site.
        </p>
      </DocTitle>

      <p>
        Below, <code>{site}</code> stands for your own booking address. You&apos;ll find yours, ready to copy, on the{" "}
        <Place>Setup</Place> page and under <Place>Settings → General</Place>.
      </p>

      <h2>Your booking link</h2>
      <p>
        Your booking address works on its own as a website, so share it wherever customers find you: your Instagram
        bio, your Google Business Profile, Facebook, and quick replies in WhatsApp.
      </p>
      <p>You can also link straight to part of it:</p>
      <SimpleTable
        head={["Link", "Opens"]}
        rows={[
          [<code key="a">{site}</code>, "Your booking home page, listing every service."],
          [<code key="b">{`${site}/services/${exampleService.slug}`}</code>, "That service's own page, with photos and details."],
          [
            <code key="c">{`${site}/quote`}</code>,
            "The quote and booking form, starting at the first step.",
          ],
          [
            <code key="d">{`${site}/quote?service=${exampleService.slug}`}</code>,
            "The form with that service already chosen, so the customer starts at the next step.",
          ],
        ]}
      />
      <p>
        Use this on the &quot;Book&quot; button for each service on your own site, so customers don&apos;t have to choose
        it again. The <code>service</code> value is the service&apos;s <strong>Link name</strong>, which you can see
        and change when editing it under <Place>Packages</Place>. The service&apos;s id works too, and the API gives you these links ready made
        as <code>bookUrl</code>. If the value doesn&apos;t match a service, or the service is switched off, the form
        simply starts at the first step.
      </p>
      <p>
        If you set your website&apos;s address under <Place>Settings → General</Place>, your booking page shows a
        &quot;Back to website&quot; link to it.
      </p>

      <h2 id="embed">The Instant quote button</h2>
      <p>
        Add one line to your website and every page gets a floating <strong>Instant quote</strong> button in your brand
        colour. It opens your booking form in a panel at the side, so customers get a price without leaving your site.
      </p>
      <CodeBlock title="HTML" code={`<script src="${site}/embed.js" async></script>`} />
      <p>
        Paste it just before <code>&lt;/body&gt;</code>, or into your site builder&apos;s &quot;custom code&quot; or
        &quot;footer scripts&quot; box. That&apos;s it: there&apos;s nothing else to set up, and it only needs adding once
        for the whole site. The same line, with your own address, is on your <Place>Setup</Place> page.
      </p>
      <Callout>
        <p>
          Customers can&apos;t pay inside the panel, because Stripe&apos;s checkout needs its own page. When they pay a
          deposit, the whole window goes to Stripe, and afterwards to your booking confirmation.
        </p>
      </Callout>

      <h3>Use your own buttons</h3>
      <p>
        Add <code>data-instant-quote</code> to any link or button on your site, and clicking it opens the panel too.
        Handy for a &quot;Get a price&quot; button in your header or on each service.
      </p>
      <CodeBlock title="HTML" code={`<a href="${site}" data-instant-quote>Get an instant quote</a>`} />
      <p>
        Pointing the link at your booking address as well means it still works if the script hasn&apos;t loaded.
      </p>
      <p>
        To open the panel with a service already chosen, give the attribute that service&apos;s Link name. Point the link at
        the same service, so it still goes to the right place without the script:
      </p>
      <CodeBlock
        title="HTML"
        code={`<a href="${site}/quote?service=${exampleService.slug}" data-instant-quote="${exampleService.slug}">
  Book a ${exampleService.name.toLowerCase()}
</a>`}
      />

      <h3>Open it from your own code</h3>
      <p>Once the script has loaded, it adds a small object to the page:</p>
      <CodeBlock
        title="JavaScript"
        code={`window.InstantQuote.open();                        // open the panel
window.InstantQuote.open("${exampleService.slug}");  // open it with a service chosen
window.InstantQuote.close();                       // close it`}
      />

      <h3>Where it works</h3>
      <p>
        Any site that lets you add a script: WordPress, Wix, Squarespace, Webflow, Shopify, or one built by hand. If
        your builder only lets you add a link, use your booking link instead.
      </p>

      <h2>Your services on your own site</h2>
      <p>
        If your website lists your services and prices, it can read them from us instead of you typing them in twice.
        Change a price in your dashboard and your site picks it up. This needs whoever built your site to add a few
        lines of code. Point them at <Link href={docsUrl("/api")}>the API docs</Link>.
      </p>
    </>
  );
}
