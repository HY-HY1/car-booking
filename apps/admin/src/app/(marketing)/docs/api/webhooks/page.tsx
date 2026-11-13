import type { Metadata } from "next";
import Link from "next/link";
import { WEBHOOK_EVENT_KEYS, WEBHOOK_EVENTS } from "@leadgen/core/webhooks/rules";
import { MAX_ENDPOINTS } from "@leadgen/core/webhooks/deliver";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Endpoint, FieldTable, ParamTable, Place, Statuses } from "@/components/docs/docs-kit";
import { exampleBooking, exampleWebhook } from "@/lib/docs-examples";
import { apiUrl, docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "Webhooks" };

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

const envelope = (type: string, data: unknown) =>
  JSON.stringify({ id: "evt_3f9c1a7e2b8d4c6f9a0e1d2c3b4a5f6e", type, createdAt: "2026-11-12T09:41:07.512Z", data }, null, 2);

export default function WebhooksDocs() {
  const hooks = apiUrl("/v1/webhooks", { absolute: true });

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

      <h2 id="payload">What&apos;s sent</h2>
      <p>
        A <code>POST</code> with a JSON body: an envelope with the event&apos;s <code>id</code>, <code>type</code> and{" "}
        <code>createdAt</code>, and its <code>data</code>.
      </p>
      <ul>
        <li>
          Booking events carry <code>data.booking</code>: the whole booking as it is now, the same object as{" "}
          <Link href={docsUrl("/api/bookings#booking")}>GET /bookings/{"{id}"}</Link>. Your team&apos;s internal notes are
          never sent.
        </li>
        <li>
          <code>lead.created</code> carries <code>data.lead</code>, the same object as{" "}
          <Link href={docsUrl("/api/leads#lead")}>GET /leads/{"{id}"}</Link>.
        </li>
        <li>
          <code>ping</code>, from <Place>Send a test</Place>, carries <code>data.message</code>.
        </li>
      </ul>
      <p>
        The type for the whole body is <code>WebhookPayload</code> on <Link href={docsUrl("/api/types")}>TypeScript types</Link>.
      </p>
      <CodeBlock title="booking.created" code={envelope("booking.created", { booking: exampleBooking() })} />

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
        <code>data.booking.updatedAt</code> to keep the newest.
      </p>
      <h2 id="manage">Managing webhooks through the API</h2>
      <p>
        Most businesses add webhooks in the dashboard. Tools that set themselves up, such as a Zapier integration, can
        add and remove them with a key that has the <code>webhooks:write</code> scope. These are the same webhooks the
        dashboard shows, up to {MAX_ENDPOINTS} per business.
      </p>

      <h3>List webhooks</h3>
      <Endpoint method="GET" path={hooks} scope="webhooks:write" />
      <p>
        <code>200 OK</code> with <code>{"{ data: Webhook[] }"}</code>, oldest first. Not paged.
      </p>

      <h3>Add a webhook</h3>
      <Endpoint method="POST" path={hooks} scope="webhooks:write" />
      <ParamTable
        params={[
          { name: "url", type: "string", required: true, text: "Where to send events. https only, and not a private network address." },
          {
            name: "events",
            type: "string[]",
            required: true,
            text: (
              <>
                The events to send, from the list above, such as <code>[&quot;booking.created&quot;]</code>.
              </>
            ),
          },
          { name: "description", type: "string", text: "A note to show in the dashboard. Up to 200 characters." },
        ]}
      />
      <CodeBlock
        title="Terminal"
        code={`curl ${hooks} \\\n  -H "Authorization: Bearer $BOOKING_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify({ url: exampleWebhook.url, events: exampleWebhook.events, description: exampleWebhook.description })}'`}
      />
      <p>
        <code>201 Created</code> with the webhook and its signing secret. <strong>The secret is only ever returned
        here</strong>: store it to check signatures.
      </p>
      <CodeBlock
        title="201 Created · application/json"
        code={JSON.stringify({ ...exampleWebhook, secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw" }, null, 2)}
      />
      <Statuses
        rows={[
          ["201", "Added. It starts getting events straight away."],
          ["400", <><code>invalid_request</code>: a bad url or an unknown event. <code>param</code> says which.</>],
          ["409", <><code>limit_reached</code>: the business already has {MAX_ENDPOINTS}.</>],
          ["401, 403, 429", <Link key="e" href={docsUrl("/api#errors")}>The usual errors</Link>],
        ]}
      />

      <h3>Get a webhook</h3>
      <Endpoint method="GET" path={`${hooks}/{id}`} scope="webhooks:write" />
      <p>
        <code>200 OK</code> with the <code>Webhook</code>, or <code>404</code> <code>not_found</code>.
      </p>

      <h3>Remove a webhook</h3>
      <Endpoint method="DELETE" path={`${hooks}/{id}`} scope="webhooks:write" />
      <p>
        <code>204 No Content</code>, or <code>404</code> <code>not_found</code>. Nothing more is sent to it, including
        retries.
      </p>

      <h3 id="webhook">Webhook</h3>
      <FieldTable
        fields={[
          { name: "id", type: "string", text: "A UUID." },
          { name: "url", type: "string", text: "Where events go." },
          { name: "description", type: "string | null", text: "The note shown in the dashboard." },
          { name: "events", type: "string[]", text: "The events it gets." },
          {
            name: "active",
            type: "boolean",
            text: `False once paused after ${50} failures in a row, or switched off in the dashboard.`,
          },
          { name: "createdAt", type: "string", text: "When it was added." },
          { name: "secret", type: "string", text: "Only when it's added: the signing secret, whsec_…" },
        ]}
      />
    </>
  );
}
