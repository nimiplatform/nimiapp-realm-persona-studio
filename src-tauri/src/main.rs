#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nimi_shell_tauri::capabilities::session_logging;

fn install_app_runtime_host(app: &tauri::App<tauri::Wry>) {
    use tauri::Manager;
    app.manage(
        nimi_shell_tauri::capabilities::runtime::RuntimeBridgeAppHost::platform_default(),
    );
}

fn main() {
    session_logging::set_app_session_prefix("realm-persona-studio");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("realm-persona-studio main() entered");

    tauri::Builder::default()
        .setup(|app| {
            install_app_runtime_host(app);
            Ok(())
        })
        .invoke_handler(nimi_shell_tauri::nimi_shell_tauri_installed_app_standard_shell_handler![])
        .run(tauri::generate_context!())
        .expect("failed to run Realm Persona Studio");
}
