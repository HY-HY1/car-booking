"use client";

import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, SaveForm, type Action } from "../form-kit";
import { AppHeader, appCard, DisconnectButton, OutcomeNote, type Outcome } from "./connection-bits";
import Link from "next/link";

// Settings → Integrations: Facebook and Instagram lead forms.

export type MetaCardProps = {
  configured: boolean;
  missingHint: string | null;
  canEdit: boolean;
  connectHref: string;
  leadsHref: string;
  outcome: string | null;
  connection: {
    accountName: string | null;
    pageName: string | null;
    status: "choose_page" | "active" | "needs_reconnect";
    lastError: string | null;
    lastLeadAt: string | null;
  } | null;
  // Only while a Page still has to be picked; null if Facebook couldn't be asked.
  pages: { id: string; name: string }[] | null;
  lastLeadLabel: string | null;
  chooseAction: Action;
  disconnectAction: () => Promise<SaveState>;
};

const OUTCOMES: Record<string, Outcome> = {
  connected: { text: "Connected. New leads from your forms will arrive in Leads.", good: true },
  choose_page: { text: "Connected. Now pick the Page your ads run from.", good: true },
  page_failed: { text: "Connected, but Facebook wouldn't send that Page's leads. Check you're an admin of the Page, then pick it again." },
  denied: { text: "Facebook wasn't given access, so nothing was connected." },
  scope: { text: "Facebook needs every permission it asked for to read your leads. Connect again and allow them all." },
  expired: { text: "That took too long or was started somewhere else. Try connecting again." },
  failed: { text: "Couldn't connect to Facebook just now. Try again." },
  no_access: { text: "Your access level doesn't include changing integrations." },
  unconfigured: { text: "Facebook login isn't set up on this platform yet." },
};

export function MetaLeadsCard(props: MetaCardProps) {
  const { connection, configured, canEdit } = props;

  return (
    <li className={appCard}>
      <AppHeader
        name="Facebook and Instagram lead forms"
        about="Enquiries from your Meta lead ads arrive here as leads."
        badge={
        <Badge tone={connection?.status === "active" ? "success" : connection ? "warning" : "neutral"}>
          {!connection
            ? configured
              ? "Not connected"
              : "Coming soon"
            : connection.status === "active"
              ? "Connected"
              : connection.status === "choose_page"
                ? "Pick your Page"
                : "Needs reconnecting"}
        </Badge>
        }
      />

      <OutcomeNote note={props.outcome ? OUTCOMES[props.outcome] : undefined} />
      {!configured && props.missingHint && <p className="text-xs text-muted-foreground">{props.missingHint}</p>}

      {configured && !connection && (
        <>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>Each form someone sends becomes a lead, with every answer they gave, a minute or so later.</li>
            <li>They&apos;re matched to existing customers by email or phone, so nobody is added twice.</li>
            <li>Nobody is signed up to your marketing emails from a lead form.</li>
          </ul>
          {canEdit && (
            <div>
              <a href={props.connectHref} className={buttonVariants()}>
                Connect Facebook
              </a>
            </div>
          )}
        </>
      )}

      {connection?.status === "needs_reconnect" && (
        <div className="grid gap-3">
          <p>
            Facebook stopped letting us read your leads{connection.lastError ? `: ${connection.lastError}` : "."} New leads
            aren&apos;t arriving until you connect again.
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-3">
              <a href={props.connectHref} className={buttonVariants()}>
                Reconnect Facebook
              </a>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}

      {connection?.status === "choose_page" && (
        <div className="grid gap-3">
          {connection.lastError && <p className="text-destructive">{connection.lastError}</p>}
          {props.pages === null ? (
            <p className="text-muted-foreground">Couldn&apos;t load your Pages from Facebook just now. Reload to try again.</p>
          ) : props.pages.length > 0 ? (
            <SaveForm action={props.chooseAction} readOnly={!canEdit} alwaysEnabled submitLabel="Use this Page" savedText="Saved. New leads will arrive in Leads.">
              {(errors) => (
                <Field label="The Page your ads run from" name="page" error={errors.page}>
                  <Select name="page" defaultValue={props.pages?.[0]?.id}>
                    {props.pages?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </SaveForm>
          ) : null}
          {canEdit && (
            <div>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}

      {connection?.status === "active" && (
        <div className="grid gap-3 text-sm">
          <p>
            New leads from <span className="font-medium">{connection.pageName}</span>&apos;s forms arrive in{" "}
            <Link href={props.leadsHref} className="underline underline-offset-4 hover:text-foreground">
              Leads
            </Link>
            . {props.lastLeadLabel ? `The last one came in ${props.lastLeadLabel}.` : "None yet."}
          </p>
          {connection.lastError && <p className="text-destructive">{connection.lastError}</p>}
          <p className="text-muted-foreground">
            Leads sent before you connected aren&apos;t brought in: download those from Meta&apos;s Leads Center and use Customers → Import.
            To use a different Page, disconnect and connect again.
          </p>
          {canEdit && (
            <div>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function Disconnect({ action }: { action: () => Promise<SaveState> }) {
  return (
    <DisconnectButton
      title="Disconnect Facebook?"
      description="New leads from your forms stop arriving here. Leads already here stay."
      done="Facebook disconnected"
      action={action}
    />
  );
}
