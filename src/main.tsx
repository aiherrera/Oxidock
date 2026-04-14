import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { applyResolvedTheme, loadThemePreference, resolveThemePreference } from "./lib/theme-settings";

applyResolvedTheme(resolveThemePreference(loadThemePreference()));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
