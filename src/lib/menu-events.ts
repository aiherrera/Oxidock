import type { AppPage } from "../types/app";

export const MENU_ACTION_EVENT = "menu-action";

export type MenuActionId =
  | "refresh_docker"
  | "focus_search"
  | "open_settings"
  | "navigate_containers"
  | "navigate_images"
  | "navigate_volumes"
  | "navigate_networks"
  | "navigate_events"
  | "navigate_logs"
  | "navigate_cli"
  | "navigate_docs";

export type MenuActionPayload = {
  action: MenuActionId;
};

const MENU_PAGE_MAP: Partial<Record<MenuActionId, AppPage>> = {
  navigate_containers: "containers",
  navigate_images: "images",
  navigate_volumes: "volumes",
  navigate_networks: "networks",
  navigate_events: "events",
  navigate_logs: "logs",
  navigate_cli: "cli",
  navigate_docs: "docs",
  open_settings: "settings",
};

export function pageFromMenuAction(action: MenuActionId): AppPage | null {
  return MENU_PAGE_MAP[action] ?? null;
}

export function isMenuActionId(value: string): value is MenuActionId {
  return (
    value === "refresh_docker" ||
    value === "focus_search" ||
    value === "open_settings" ||
    value === "navigate_containers" ||
    value === "navigate_images" ||
    value === "navigate_volumes" ||
    value === "navigate_networks" ||
    value === "navigate_events" ||
    value === "navigate_logs" ||
    value === "navigate_cli" ||
    value === "navigate_docs"
  );
}
