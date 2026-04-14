export type AppPage =
  | "containers"
  | "images"
  | "volumes"
  | "networks"
  | "events"
  | "logs"
  | "cli"
  | "docs"
  | "settings";

export const APP_PAGES: { id: AppPage; label: string; section: "overview" | "tools" }[] = [
  { id: "containers", label: "Containers", section: "overview" },
  { id: "images", label: "Images", section: "overview" },
  { id: "volumes", label: "Volumes", section: "overview" },
  { id: "networks", label: "Networks", section: "overview" },
  { id: "events", label: "Events", section: "overview" },
  { id: "logs", label: "Logs", section: "tools" },
  { id: "cli", label: "CLI Playground", section: "tools" },
  { id: "docs", label: "Docs", section: "tools" },
  { id: "settings", label: "Settings", section: "tools" },
];
