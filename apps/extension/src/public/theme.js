// The studio's light/dark choice, applied before the page paints (Manifest V3 forbids inline scripts).
try {
  var t = localStorage.getItem("rs:ui-theme");
  if (t === "dark" || t === "light") document.documentElement.dataset.theme = t;
} catch (e) {}
