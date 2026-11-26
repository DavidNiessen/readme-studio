import { lazy, Suspense, useEffect } from "react";
import { ToastProvider } from "./components/ui";
import { useRoute } from "./lib/router";
import { loadPage } from "./lib/staleBuild";
import { Landing } from "./pages/Landing";

// after a deploy an open page may ask for files that are gone; loadPage reloads onto the new build
const Studio = lazy(loadPage(() => import("./studio/Studio")));
const Presets = lazy(loadPage(() => import("./pages/Presets")));
const Docs = lazy(loadPage(() => import("./pages/Docs")));

const TITLES: Record<string, string> = {
  "/": "Readme Studio: animated GitHub profile READMEs",
  "/studio": "Studio · Readme Studio",
  "/presets": "Presets · Readme Studio",
  "/docs": "Docs · Readme Studio",
};

function Loading() {
  return (
    <div style={{ height: "100vh", display: "grid", placeItems: "center", color: "var(--muted)" }}>
      <div className="spinner" />
    </div>
  );
}

export function App() {
  const route = useRoute();
  const top = `/${route.path.split("/")[1] ?? ""}`;
  useEffect(() => {
    document.title = TITLES[top] ?? TITLES["/"];
  }, [top]);
  let page;
  if (top === "/studio") page = <Studio />;
  else if (top === "/presets") page = <Presets />;
  else if (top === "/docs") page = <Docs section={route.path.split("/")[2] ?? ""} />;
  else page = <Landing />;
  return (
    <ToastProvider>
      <Suspense fallback={<Loading />}>{page}</Suspense>
    </ToastProvider>
  );
}
