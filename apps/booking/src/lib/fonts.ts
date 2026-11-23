import {
  Archivo_Black,
  Bebas_Neue,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Geist,
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
import { DEFAULT_FONT, isBodyFont, type FontKey } from "@leadgen/core/branding/fonts";

// The typefaces a business can pick (core/branding/fonts.ts). next/font
// downloads them at build time and serves them from this app, so visitors'
// browsers never contact Google. Only the standard one is preloaded: the
// rest are declared on every page but a browser only fetches a file once
// text on the page uses it. The display faces with a single weight are
// never drawn fake-bold (globals.css, font-synthesis on headings).

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

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
  geist,
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

// On <html>: the standard face, for pages with no business (globals.css).
export const defaultFontVariable = geist.variable;

// The CSS variables for a business's picks, set on <body> with its colours.
// Unset body text is the standard face; unset headings follow the body.
export function fontVariables(heading?: FontKey, body?: FontKey): Record<string, string> {
  const bodyKey = body && isBodyFont(body) ? body : DEFAULT_FONT;
  const vars: Record<string, string> = {};
  if (bodyKey !== DEFAULT_FONT) vars["--tenant-body"] = FONT_FACES[bodyKey].style.fontFamily;
  if (heading && heading !== bodyKey) vars["--tenant-heading"] = FONT_FACES[heading].style.fontFamily;
  return vars;
}
