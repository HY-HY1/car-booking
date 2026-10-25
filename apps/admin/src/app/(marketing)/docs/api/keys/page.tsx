import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/code-block";
import { Callout, DocTitle, Place } from "@/components/docs/docs-kit";
import { docsUrl } from "@/lib/urls";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeys() {
  return (
    <>
      <DocTitle eyebrow="API" title="API keys">
        <p>How to create, store, rotate and revoke the keys that give a website access to the API.</p>
      </DocTitle>

      <h2>Creating a key</h2>
      <p>Only the business owner can manage keys.</p>
      <ol>
        <li>
          In the dashboard, go to <Place>Settings → API</Place>.
        </li>
        <li>
          Give the key a name that says where it&apos;s used, like <em>Main website</em>, and create it.
        </li>
        <li>
          <strong>Copy the key straight away.</strong> It&apos;s shown once and never again.
        </li>
      </ol>
      <p>
        We only store a fingerprint of each key, not the key itself, so nobody can look it up later, us included. If a
        key is lost, revoke it and create another.
      </p>

      <h2>What a key looks like</h2>
      <p>
        Keys start with <code>ascnd_</code>, followed by 43 letters, numbers, <code>-</code> and <code>_</code>:
      </p>
      <CodeBlock title="Example (not a real key)" code="ascnd_Xq3vT9bLk2mP8wRz4nYc6hJd1sFg7aEu5oKi0tVbNxw" />
      <p>
        The key list in the dashboard shows each key&apos;s first few characters, so you can tell which is which,
        along with when it was made and when it was last used.
      </p>

      <h2>Sending the key</h2>
      <p>
        Send it in the <code>Authorization</code> header on every request, after the word <code>Bearer</code>:
      </p>
      <CodeBlock title="Header" code="Authorization: Bearer ascnd_YOUR_KEY" />
      <p>
        Keys in the URL or the request body aren&apos;t accepted. A missing or badly formed header gets a{" "}
        <code>401</code> with the code <code>missing_key</code>. See <Link href={docsUrl("/api#errors")}>Errors</Link>.
      </p>

      <h2>Keeping it safe</h2>
      <p>A key reads only public product data, but treat it like a password anyway:</p>
      <ul>
        <li>
          Keep it in an environment variable or your host&apos;s secret settings, such as <code>BOOKING_API_KEY</code>.
        </li>
        <li>Never put it in code that runs in the browser, and never commit it to Git.</li>
        <li>Use a separate key for each site or system, so you can revoke one without breaking the others.</li>
      </ul>
      <Callout tone="warning">
        <p>
          If a key ends up somewhere public, revoke it straight away and make a new one. See{" "}
          <Link href={docsUrl("/api#server-only")}>why the API is server-only</Link>.
        </p>
      </Callout>

      <h2>Revoking and rotating</h2>
      <p>
        <Place>Revoke</Place> next to a key in <Place>Settings → API</Place> stops it working at once: the next request
        with it gets a <code>401</code> with the code <code>invalid_key</code>. It can&apos;t be switched back on.
      </p>
      <p>To swap a key without any downtime:</p>
      <ol>
        <li>Create a new key.</li>
        <li>Put it into your site&apos;s settings and deploy.</li>
        <li>
          Check that the old key&apos;s <em>last used</em> date has stopped moving, then revoke it. It updates at most
          once an hour.
        </li>
      </ol>
    </>
  );
}
