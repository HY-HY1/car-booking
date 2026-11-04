"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { disconnectCalendar, reconcileCalendar, saveCalendarChoices } from "@leadgen/core/calendar/sync";
import type { SaveState } from "@/app/app/[tenant]/pricing/actions";
import { failed, plain, requireOwner } from "../shared";

// Settings → Integrations → Google Calendar. Owners and managers; written
// with the secret key, so requireOwner is what stops anyone else.

// Google's calendar ids: "primary", an address, or a long group id.
const CALENDAR_ID = /^[^\s]{1,1024}$/;

export async function saveCalendarAction(slug: string, formData: FormData): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;

  const values = plain(formData);
  const defaultCalendarId = values.default_calendar ?? "";
  if (!CALENDAR_ID.test(defaultCalendarId)) return { errors: { default_calendar: "Pick one of your calendars." } };
  // resource:<id> → that van's own calendar, or "" for the business's.
  const byResource: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!key.startsWith("resource:")) continue;
    if (value && !CALENDAR_ID.test(value)) return { message: "Pick one of your calendars for each van." };
    byResource[key.slice("resource:".length)] = value || null;
  }

  try {
    const result = await saveCalendarChoices(tenant.id, { defaultCalendarId, byResource });
    if (result.error) return { message: result.error };
  } catch (error) {
    return failed("your calendars", error);
  }
  // Jobs move to their new calendars, and busy times are read from them.
  after(() => reconcileCalendar(tenant.id));
  refresh();
  return { saved: true };
}

export async function disconnectCalendarAction(slug: string): Promise<SaveState> {
  const { tenant, denied } = await requireOwner(slug);
  if (denied) return denied;
  try {
    await disconnectCalendar(tenant.id);
  } catch (error) {
    console.error("Disconnecting Google Calendar failed", error);
    return { message: "Couldn't disconnect Google Calendar. Try again." };
  }
  refresh();
  return {};
}
