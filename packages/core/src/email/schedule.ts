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

// How often the job runs, in minutes (EMAIL_JOB_INTERVAL_MINUTES). Vercel
// Cron on the Hobby plan runs it once a day (vercel.json), so that's the
// default; set it to 15 when something calls the job every 15 minutes.
export function jobIntervalMins(env: string | undefined = process.env.EMAIL_JOB_INTERVAL_MINUTES) {
  const n = Number(env);
  return Number.isFinite(n) && n >= 1 && n <= 1440 ? Math.round(n) : 1440;
}

// A reminder goes on the run nearest its moment (`hoursBefore` the start),
// which may be a little before it: with a daily job at 7am, "24 hours before"
// a 9am Wednesday job is sent at 7am on Tuesday, not 7am on the day. It's
// only sent if the booking was made before that moment: someone who books
// for this afternoon has just had their confirmation.
export function reminderDue(b: { startsAt: Date; createdAt: Date }, hoursBefore: number, now: Date, intervalMins = jobIntervalMins()) {
  const opens = b.startsAt.getTime() - hoursBefore * HOUR;
  const early = (intervalMins * 60_000) / 2;
  return b.startsAt > now && opens - early <= now.getTime() && b.createdAt.getTime() < opens;
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
    // Plus the half-run a reminder may go early by.
    remindersUntil: new Date(now.getTime() + 168 * HOUR + (jobIntervalMins() * 60_000) / 2),
    jobsEndedAfter: new Date(now.getTime() - (60 + CATCH_UP_DAYS) * DAY),
    leadsCreatedAfter: new Date(now.getTime() - 2 * DAY),
    leadsCreatedBefore: new Date(now.getTime() - LEAD_ALERT_DELAY_MINS * 60_000),
  };
}
