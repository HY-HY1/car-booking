// When the messages sent by the scheduled job are due (email/notify.ts,
// runScheduledEmails). The job runs every 15 minutes, so each rule is a
// window rather than an exact moment, and sending once is left to the email
// log's dedupe key. Pure.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// How far back a missed message is still worth sending: a job that was down
// for a day catches up, but turning follow-ups on doesn't email every
// customer from last year.
export const CATCH_UP_DAYS = 7;

// How long a customer has to finish booking before the business hears about
// the enquiry, so an enquiry that turns into a booking only sends one alert.
export const LEAD_ALERT_DELAY_MINS = 30;

// Inside the window before the appointment, and only if the booking was made
// before the window opened: someone who books for this afternoon has just had
// their confirmation.
export function reminderDue(b: { startsAt: Date; createdAt: Date }, hoursBefore: number, now: Date) {
  const opens = b.startsAt.getTime() - hoursBefore * HOUR;
  return b.startsAt > now && opens <= now.getTime() && b.createdAt.getTime() < opens;
}

// Aftercare and review requests: some days after the job ended.
export function afterJobDue(endsAt: Date, daysAfter: number, now: Date) {
  const due = endsAt.getTime() + daysAfter * DAY;
  return due <= now.getTime() && due > now.getTime() - CATCH_UP_DAYS * DAY;
}

export function leadAlertDue(createdAt: Date, now: Date) {
  const age = now.getTime() - createdAt.getTime();
  return age >= LEAD_ALERT_DELAY_MINS * 60_000 && age < 2 * DAY;
}

// The widest windows the job has to read: reminders up to a week ahead (the
// longest hours_before), jobs that ended up to 60 days + the catch-up ago
// (the longest days_after).
export function scheduledWindows(now: Date) {
  return {
    remindersUntil: new Date(now.getTime() + 168 * HOUR),
    jobsEndedAfter: new Date(now.getTime() - (60 + CATCH_UP_DAYS) * DAY),
    leadsCreatedAfter: new Date(now.getTime() - 2 * DAY),
    leadsCreatedBefore: new Date(now.getTime() - LEAD_ALERT_DELAY_MINS * 60_000),
  };
}
