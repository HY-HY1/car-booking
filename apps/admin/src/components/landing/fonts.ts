import { Big_Shoulders, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// The marketing site's type (app/(marketing)/(site)/landing.css): condensed
// display, plain body, mono for times and prices. Shared with the sign-up
// page, which wears the same look so it reads as the same product.

const display = Big_Shoulders({ subsets: ["latin"], axes: ["opsz"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-body" });
const data = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-data" });

// The CSS variables for all three, for a wrapper's className.
export const landingFonts = `${display.variable} ${body.variable} ${data.variable}`;
