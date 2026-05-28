import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TooltipProvider } from "@/components/ui/tooltip";
import { applyResolvedTheme, loadThemePreference, resolveThemePreference } from "./lib/theme-settings";

applyResolvedTheme(resolveThemePreference(loadThemePreference()));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TooltipProvider>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
