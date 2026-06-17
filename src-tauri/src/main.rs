#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nimi_shell_tauri::oauth_commands;
use nimi_shell_tauri::runtime_bridge;
use nimi_shell_tauri::session_logging;

#[tauri::command]
fn realm_persona_studio_start_window_drag(window: tauri::WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }

    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        window.start_dragging().map_err(|error| error.to_string())
    })) {
        Ok(result) => result,
        Err(_) => Err("window drag unavailable".to_string()),
    }
}

fn load_dotenv_files() {
    let root_env_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../.env");
    if !root_env_path.exists() {
        return;
    }

    match dotenvy::from_path_iter(&root_env_path) {
        Ok(iter) => {
            for item in iter.flatten() {
                let (key, value) = item;
                let should_override = key.starts_with("NIMI_") || key.starts_with("VITE_NIMI_");
                if should_override || std::env::var_os(&key).is_none() {
                    std::env::set_var(&key, &value);
                }
            }
            eprintln!(
                "[realm-persona-studio] dotenv loaded path={}",
                root_env_path.display()
            );
        }
        Err(error) => {
            eprintln!(
                "[realm-persona-studio] dotenv load failed path={} error={error}",
                root_env_path.display()
            );
        }
    }
}

fn configure_runtime_bridge_env() {
    if cfg!(debug_assertions) && std::env::var_os("NIMI_RUNTIME_BRIDGE_MODE").is_none() {
        std::env::set_var("NIMI_RUNTIME_BRIDGE_MODE", "RUNTIME");
    }
}

fn main() {
    load_dotenv_files();
    configure_runtime_bridge_env();
    session_logging::set_app_session_prefix("realm-persona-studio");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("realm-persona-studio main() entered");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            realm_persona_studio_start_window_drag,
            oauth_commands::open_external_url,
            oauth_commands::oauth_listen_for_code,
            runtime_bridge::runtime_bridge_unary,
            runtime_bridge::runtime_bridge_stream_open,
            runtime_bridge::runtime_bridge_stream_close,
            runtime_bridge::runtime_bridge_status,
            session_logging::log_renderer_event,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Realm Persona Studio");
}
