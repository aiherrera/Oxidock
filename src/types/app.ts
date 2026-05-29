export type AppPage =
  | "dashboard"
  | "containers"
  | "images"
  | "volumes"
  | "networks"
  | "events"
  | "logs"
  | "assistant"
  | "cli"
  | "docs"
  | "settings";

export type AppPageSection = "overview" | "tools" | "learn";

export const APP_PAGE_SECTIONS: { id: AppPageSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tools", label: "Tools" },
  { id: "learn", label: "Learn" },
];

export const APP_PAGES: { id: AppPage; label: string; section: AppPageSection }[] = [
  { id: "dashboard", label: "Dashboard", section: "overview" },
  { id: "containers", label: "Containers", section: "tools" },
  { id: "images", label: "Images", section: "tools" },
  { id: "volumes", label: "Volumes", section: "tools" },
  { id: "networks", label: "Networks", section: "tools" },
  { id: "events", label: "Events", section: "tools" },
  { id: "logs", label: "Logs", section: "tools" },
  { id: "docs", label: "Command School", section: "learn" },
  { id: "cli", label: "CLI Playground", section: "learn" },
  { id: "assistant", label: "AI Assistant", section: "learn" },
];

export const getAppPagesBySection = (section: AppPageSection) => APP_PAGES.filter((page) => page.section === section);
