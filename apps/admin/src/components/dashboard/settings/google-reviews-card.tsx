"use client";

import Link from "next/link";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { CopyText } from "@/components/platform/copy-text";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, SaveForm, type Action } from "../form-kit";
import { ActionButton, AppHeader, appCard, DisconnectButton, OutcomeNote, type Outcome } from "./connection-bits";

// Settings → Integrations: Google Business Profile, for reviews.

export type ReviewsCardProps = {
  configured: boolean;
  canEdit: boolean;
  connectHref: string;
  reviewsHref: string;
  outcome: string | null;
  connection: {
    email: string | null;
    locationChosen: boolean;
    locationTitle: string | null;
    reviewUrl: string | null;
    averageRating: number | null;
    totalReviews: number | null;
    status: "active" | "needs_reconnect";
    lastError: string | null;
    lastSyncedAt: string | null;
  } | null;
  // Only when a location still has to be picked; null if Google couldn't be asked.
  locations: { locationName: string; title: string; address: string | null }[] | null;
  chooseAction: Action;
  refreshAction: () => Promise<SaveState>;
  disconnectAction: () => Promise<SaveState>;
};

const OUTCOMES: Record<string, Outcome> = {
  connected: { text: "Connected. Your reviews are coming in now.", good: true },
  denied: { text: "Google wasn't given access, so nothing was connected." },
  scope: { text: "Google needs access to manage your Business Profile. Connect again and leave the box ticked." },
  expired: { text: "That took too long or was started somewhere else. Try connecting again." },
  failed: { text: "Couldn't connect to Google just now. Try again." },
  no_access: { text: "Your access level doesn't include changing integrations." },
  unconfigured: { text: "Google sign-in isn't set up on this platform yet." },
};

export function GoogleReviewsCard(props: ReviewsCardProps) {
  const { connection, configured, canEdit } = props;
  const live = connection?.status === "active";

  return (
    <li className={appCard}>
      <AppHeader
        name="Google Business reviews"
        about="Your Google reviews in the dashboard, and replies to them without leaving it."
        badge={
        <Badge tone={live && connection.locationChosen ? "success" : connection ? "warning" : "neutral"}>
          {!connection
            ? configured
              ? "Not connected"
              : "Coming soon"
            : !live
              ? "Needs reconnecting"
              : connection.locationChosen
                ? "Connected"
                : "Pick your business"}
        </Badge>
        }
      />

      <OutcomeNote note={props.outcome ? OUTCOMES[props.outcome] : undefined} />

      {configured && !connection && (
        <>
          <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
            <li>New reviews show on the Reviews page, with the ones still waiting for a reply at the top.</li>
            <li>Replies you write there go straight onto Google, as your business.</li>
            <li>Your review link is filled in for review request emails.</li>
          </ul>
          {canEdit && (
            <div>
              <a href={props.connectHref} className={buttonVariants()}>
                Connect Google Business Profile
              </a>
            </div>
          )}
        </>
      )}

      {connection && !live && (
        <div className="grid gap-3">
          <p>
            Google stopped letting us in{connection.email ? ` to ${connection.email}` : ""}
            {connection.lastError ? `: ${connection.lastError}` : "."}
          </p>
          {canEdit && (
            <div className="flex flex-wrap gap-3">
              <a href={props.connectHref} className={buttonVariants()}>
                Reconnect Google
              </a>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}

      {connection && live && !connection.locationChosen && (
        <div className="grid gap-3">
          {connection.lastError && <p className="text-destructive">{connection.lastError}</p>}
          {props.locations === null ? (
            <p className="text-muted-foreground">Couldn&apos;t load your businesses from Google just now. Reload to try again.</p>
          ) : props.locations.length === 0 ? (
            <p>
              {connection.email ?? "This Google account"} doesn&apos;t manage any business profiles. Connect the account that does.
            </p>
          ) : (
            <SaveForm action={props.chooseAction} readOnly={!canEdit} alwaysEnabled submitLabel="Use this business" savedText="Saved. Your reviews are coming in now.">
              {(errors) => (
                <Field label="Which business?" name="location" error={errors.location}>
                  <Select name="location" defaultValue={props.locations?.[0]?.locationName}>
                    {props.locations?.map((l) => (
                      <option key={l.locationName} value={l.locationName}>
                        {l.address ? `${l.title} (${l.address})` : l.title}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
            </SaveForm>
          )}
          {canEdit && (
            <div>
              <Disconnect action={props.disconnectAction} />
            </div>
          )}
        </div>
      )}

      {connection && live && connection.locationChosen && (
        <div className="grid gap-3">
          <p>
            Showing reviews for <span className="font-medium">{connection.locationTitle}</span>
            {connection.email ? `, connected as ${connection.email}` : ""}.
            {connection.averageRating !== null && connection.totalReviews !== null && (
              <> {connection.averageRating.toFixed(1)} stars from {connection.totalReviews} reviews.</>
            )}
          </p>
          {connection.lastError && <p className="text-destructive">{connection.lastError}</p>}
          {connection.reviewUrl && (
            <div className="grid gap-1">
              <span className="text-muted-foreground">Link for customers to leave a review:</span>
              <CopyText value={connection.reviewUrl} label="review link" />
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Link href={props.reviewsHref} className={buttonVariants({ variant: "outline" })}>
              See your reviews
            </Link>
            {canEdit && <ActionButton label="Check for new reviews" busyLabel="Checking…" done="Reviews updated" action={props.refreshAction} />}
            {canEdit && <Disconnect action={props.disconnectAction} />}
          </div>
        </div>
      )}
    </li>
  );
}

function Disconnect({ action }: { action: () => Promise<SaveState> }) {
  return (
    <DisconnectButton
      title="Disconnect Google Business Profile?"
      description="Your reviews stop showing here and you can't reply from the dashboard. Nothing changes on Google."
      done="Google Business Profile disconnected"
      action={action}
    />
  );
}
