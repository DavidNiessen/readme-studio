// Applies the saved light/dark choice before the page paints. A file of its own, not inline, so
// the site's Content Security Policy can forbid inline scripts.
try {
  var t = localStorage.getItem("rs:ui-theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
