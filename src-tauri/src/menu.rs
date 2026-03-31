use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    App, Emitter,
};

pub const MENU_EVENT: &str = "menu-action";

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuActionPayload {
    pub action: String,
}

pub fn setup_menu(app: &App) -> tauri::Result<()> {
    let handle = app.handle();

    let refresh = MenuItemBuilder::with_id("refresh_docker", "Refresh Docker Status")
        .accelerator("CmdOrCtrl+R")
        .build(app)?;
    let focus_search = MenuItemBuilder::with_id("focus_search", "Focus Search")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let settings = MenuItemBuilder::with_id("open_settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&focus_search)
        .separator()
        .text("navigate_containers", "Containers")
        .text("navigate_images", "Images")
        .text("navigate_volumes", "Volumes")
        .text("navigate_networks", "Networks")
        .text("navigate_events", "Events")
        .text("navigate_logs", "Logs")
        .text("navigate_cli", "CLI Playground")
        .text("navigate_docs", "Docs")
        .separator()
        .item(&refresh)
        .build()?;

    let docker_submenu = SubmenuBuilder::new(app, "Docker")
        .text("docker_navigate_containers", "Containers")
        .text("docker_navigate_images", "Images")
        .text("docker_navigate_volumes", "Volumes")
        .text("docker_navigate_networks", "Networks")
        .text("docker_navigate_events", "Events")
        .text("docker_navigate_logs", "Logs")
        .separator()
        .item(&refresh)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .text("navigate_docs", "Documentation")
        .build()?;

    let mut menu_builder = MenuBuilder::new(app);

    #[cfg(target_os = "macos")]
    {
        let app_submenu = SubmenuBuilder::new(app, "Oxidock")
            .about(None)
            .separator()
            .item(&settings)
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu_builder = menu_builder.item(&app_submenu);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let file_submenu = SubmenuBuilder::new(app, "File")
            .item(&settings)
            .separator()
            .close_window()
            .quit()
            .build()?;
        menu_builder = menu_builder.item(&file_submenu);
    }

    let menu = menu_builder
        .item(&view_submenu)
        .item(&docker_submenu)
        .item(&help_submenu)
        .build()?;

    app.set_menu(menu)?;

    let emit_handle = handle.clone();
    app.on_menu_event(move |_app, event| {
        let id = event.id().0.as_str();
        let action = match id {
            "docker_navigate_containers" => Some("navigate_containers"),
            "docker_navigate_images" => Some("navigate_images"),
            "docker_navigate_volumes" => Some("navigate_volumes"),
            "docker_navigate_networks" => Some("navigate_networks"),
            "docker_navigate_events" => Some("navigate_events"),
            "docker_navigate_logs" => Some("navigate_logs"),
            "refresh_docker"
            | "focus_search"
            | "open_settings"
            | "navigate_containers"
            | "navigate_images"
            | "navigate_volumes"
            | "navigate_networks"
            | "navigate_events"
            | "navigate_logs"
            | "navigate_cli"
            | "navigate_docs" => Some(id),
            _ => None,
        };

        if let Some(action) = action {
            let _ = emit_handle.emit(
                MENU_EVENT,
                MenuActionPayload {
                    action: action.to_string(),
                },
            );
        }
    });

    Ok(())
}
