import "./studio/styles";
import "./styles/site.css";
import "./styles/docs.css";
import "./styles/landing.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { watchStaleBuild } from "./lib/staleBuild";

watchStaleBuild();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
