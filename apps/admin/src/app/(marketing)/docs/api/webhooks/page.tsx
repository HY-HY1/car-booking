import type { Metadata } from "next";
import { WEBHOOK_EVENT_KEYS, WEBHOOK_EVENTS } from "@leadgen/core/webhooks/rules";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Place } from "@/components/docs/docs-kit";

export const metadata: Metadata = { title: "Webhooks" };

const EXAMPLE = `{
  "id": "evt_3f9c1a7e2b8d4c6f9a0e1d2c3b4a5f6e",
  "type": "booking.created",
  "created_at": "2026-11-12T09:41:07.512Z",
  "data": {
    "booking": {
      "id": "6d1f0c2a-7b9e-4e1a-9c3d-2f8b5a4e7d10",
      "reference": "6D1F0C2A",
      "status": "confirmed",
      "starts_at": "2026-11-20T09:00:00+00:00",
      "ends_at": "2026-11-20T12:00:00+00:00",
      "service": { "id": "…", "name": "Full valet" },
      "lines": [
        { "label": "Full valet (medium car)", "amount_pence": 12000 },
        { "label": "Pet hair removal", "amount_pence": 2000 }
      ],
      "price": { "total_pence": 14000, "deposit_pence": 2000, "deposit_status": "paid" },
      "location": { "type": "mobile", "address": "1 High Street", "postcode": "GL51 0QX" },
      "customer": { "id": "…", "name": "Sam Price", "email": "sam@example.com", "phone": "+447700900123" },
      "vehicle": { "make": "VW", "model": "Golf", "registration": "AB12CDE", "size_class": "medium" },
      "notes": "Gate code 1234",
      "van_or_bay_id": "…",
      "staff": null,
      "source": "booking_page",
      "created_at": "2026-11-12T09:41:05.120Z",
      "updated_at": "2026-11-12T09:41:06.904Z"
    }
  }
}`;

const NODE = `import crypto from "node:crypto";

// secret: the whsec_… value shown when you added the webhook.
export function isGenuine(secret, headers, rawBody) {
  const id = headers["webhook-id"];
  const timestamp = Number(headers["webhook-timestamp"]);
  // Refuse anything more than five minutes old (or from the future).
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = "v1," + crypto.createHmac("sha256", key).update(\`\${id}.\${timestamp}.\${rawBody}\`).digest("base64");
  return headers["webhook-signature"].split(" ").some((sig) =>
    sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
  );
}`;

export default function WebhooksDocs() {
  return (
    <>
      <DocTitle eyebrow="API" title="Webhooks">
        <p>Have bookings and enquiries sent to your own system as they happen, instead of asking the API for them.</p>
      </DocTitle>

      <h2>Adding a webhook</h2>
      <ol>
        <li>
          In the dashboard, go to <Place>Settings → Integrations → Developer</Place>. Only the business owner can manage webhooks.
        </li>
        <li>Enter the https address to send to, and tick the events you want.</li>
        <li>
          <strong>Copy the signing secret straight away.</strong> It&apos;s shown once. Lost it? Use <Place>New secret</Place>.
        </li>
        <li>
          Press <Place>Send a test</Place>. A <code>ping</code> event is sent, and the dashboard shows what your server answered.
        </li>
      </ol>
      <p>
        Zapier (&ldquo;Webhooks by Zapier → Catch Hook&rdquo;), Make and n8n all give you an address to paste in, if you
        don&apos;t run a server of your own.
      </p>

      <h2>Events</h2>
      <ul>
        {WEBHOOK_EVENT_KEYS.map((key) => (
          <li key={key}>
            <code>{key}</code>: {WEBHOOK_EVENTS[key]}.
          </li>
        ))}
      </ul>
      <p>
        A booking only counts once it&apos;s secured: someone part-way through paying a deposit isn&apos;t a booking yet, and
        a checkout they leave never sends anything.
      </p>

      <h2>What&apos;s sent</h2>
      <p>
        A <code>POST</code> with a JSON body. Booking events carry the whole booking, as it is now. Your team&apos;s internal
        notes are never sent. <code>lead.created</code> carries <code>data.lead</code> with the customer, the service they
        looked at, the price they were shown and, for Facebook and Instagram lead forms, their answers.
      </p>
      <CodeBlock title="booking.created" code={EXAMPLE} />

      <h2>Checking it came from us</h2>
      <p>Every request has three headers, laid out as the Standard Webhooks spec describes, so its libraries work too:</p>
      <ul>
        <li>
          <code>Webhook-Id</code>: the event&apos;s id. The same on every retry, so you can ignore one you&apos;ve already had.
        </li>
        <li>
          <code>Webhook-Timestamp</code>: when this try was sent, in seconds since 1970.
        </li>
        <li>
          <code>Webhook-Signature</code>: <code>v1,</code> then the base64 HMAC-SHA256 of{" "}
          <code>&lt;id&gt;.&lt;timestamp&gt;.&lt;body&gt;</code>, keyed with your secret (the part after <code>whsec_</code>,
          base64-decoded).
        </li>
      </ul>
      <CodeBlock title="Node.js" code={NODE} />
      <Callout tone="warning">
        <p>
          Check the signature against the raw body exactly as it arrived. Parsing the JSON and turning it back into text
          changes it, and the signature won&apos;t match.
        </p>
      </Callout>

      <h2>Answering, and retries</h2>
      <p>
        Answer with any <code>2xx</code> status within 5 seconds. Do the slow work afterwards. Anything else, a timeout or
        a redirect counts as a failure and is tried again after 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours and 24
        hours, then given up. The dashboard lists the last few deliveries for each webhook, with what your server said, and
        can send any of them again.
      </p>
      <p>
        A webhook that fails 50 times in a row is paused. Fix the problem, then switch it back on under{" "}
        <Place>Edit</Place>.
      </p>
      <p>
        Events usually arrive in the order they happened, but a retry can arrive after a later event. Use{" "}
        <code>data.booking.updated_at</code> to keep the newest.
      </p>
    </>
  );
}
