// The back button, for the "unsaved changes" warning. Listeners on window run
// in the order they were added, and the router acts as soon as it hears the
// back button. This one, inlined in <head> by app/layout.tsx, is added before
// the router exists, and hands over to whatever is watching a form.
export const HISTORY_GUARD_SCRIPT = `addEventListener("popstate",function(e){if(window.__onPopState)window.__onPopState(e)});`;
