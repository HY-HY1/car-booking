import {
  Archivo_Black,
  Bebas_Neue,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Inter,
  Lora,
  Manrope,
  Montserrat,
  Nunito,
  Oswald,
  Playfair_Display,
  Plus_Jakarta_Sans,
  Poppins,
  Space_Grotesk,
  Work_Sans,
} from "next/font/google";
import type { FontKey } from "@leadgen/core/branding/fonts";

// The booking page's typefaces (core/branding/fonts.ts), for the preview and
// the samples in Settings → Booking page → Look and feel. The same list as
// the booking app's lib/fonts.ts. Not preloaded: a browser only fetches a
// file once something on the page is drawn in it.

// next/font only reads literal options, so each is written out in full.
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600", "700"] });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false });
const nunito = Nunito({ subsets: ["latin"], display: "swap", preload: false });
const workSans = Work_Sans({ subsets: ["latin"], display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false });
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], display: "swap", preload: false, weight: "400" });
const archivoBlack = Archivo_Black({ subsets: ["latin"], display: "swap", preload: false, weight: "400" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: "400" });
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false });

export const FONT_FACES: Record<FontKey, { style: { fontFamily: string } }> = {
  // The dashboard's own face (app/layout.tsx) is the same one.
  geist: { style: { fontFamily: "var(--font-sans)" } },
  inter,
  dm_sans: dmSans,
  manrope,
  plus_jakarta: plusJakarta,
  poppins,
  montserrat,
  nunito,
  work_sans: workSans,
  space_grotesk: spaceGrotesk,
  oswald,
  bebas_neue: bebasNeue,
  archivo_black: archivoBlack,
  playfair,
  dm_serif: dmSerif,
  fraunces,
  lora,
};


// The font-family for a pick, as the booking page would draw it. Unset body
// text is the standard face; unset headings follow the body.
export function bookingFontFamilies(heading: FontKey | "", body: FontKey | "") {
  const bodyFamily = FONT_FACES[body || "geist"].style.fontFamily;
  return { body: bodyFamily, heading: heading ? FONT_FACES[heading].style.fontFamily : bodyFamily };
}
