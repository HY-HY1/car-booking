import { after } from "next/server";
import { handleCalendarPush } from "@leadgen/core/calendar/sync";

// Google Calendar push notifications: a watched calendar's events changed.
// Google sends no body, only the channel's id and the token we gave it, which
// handleCalendarPush checks before rereading the calendar. Answered straight
// away; the reread runs after the response.
export async function POST(request: Request) {
  const push = {
    channelId: request.headers.get("x-goog-channel-id"),
    token: request.headers.get("x-goog-channel-token"),
    state: request.headers.get("x-goog-resource-state"),
  };
  after(async () => {
    try {
      await handleCalendarPush(push);
    } catch (error) {
      console.error("Google Calendar push failed", error);
    }
  });
  return new Response(null, { status: 204 });
}
