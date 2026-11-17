// The visitor's light/dark choice, kept in this browser under THEME_KEY
// (switched by components/theme-toggle.tsx). Light unless they pick dark.
export const THEME_KEY = "theme";

// Runs in <head> (layout.tsx), before anything draws, so a dark page never
// flashes light first. Storage can be blocked (private windows, embeds with
// third-party storage off): then the page just stays light.
export const THEME_SCRIPT = `try{if(localStorage.getItem("${THEME_KEY}")==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
