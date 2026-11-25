import { cache } from "react";
import { getBookingConfig } from "@leadgen/core/booking/engine";

// The business's booking setup (services, hours, area), loaded once per
// request: the page and the footer's opening hours share the one fetch.
export const loadBookingConfig = cache(getBookingConfig);
