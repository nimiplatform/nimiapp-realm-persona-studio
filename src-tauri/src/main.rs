#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use nimi_shell_tauri::capabilities::{
    ai_config,
    data::{self, StandardAppStorageRootSlot, StandardDataRootBinding},
    runtime, session_logging, shell_ui, storage,
};
use nimi_shell_tauri::installed_app_launch::{
    build_installed_nimi_app_launch_binding_script,
    resolve_installed_nimi_app_launch_binding_from_env, InstalledNimiAppLaunchBindingEnvConfig,
};

const REALM_PERSONA_STUDIO_APP_ID: &str = "nimi.realm-persona-studio";
const REALM_PERSONA_STUDIO_RUNTIME_APP_INSTANCE_ID: &str =
    "nimi.realm-persona-studio.desktop-installed";
const REALM_PERSONA_STUDIO_RUNTIME_DEVICE_ID: &str = "desktop-installed-app";
const REALM_PERSONA_STUDIO_RELEASE_DESCRIPTOR_REF: &str =
    "nimi.realm-persona-studio.bundled-with-nimi";
const DESKTOP_TAURI_INSTALLED_APP_LAUNCH_HOST_ID: &str = "desktop-tauri-installed-app-host";

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

fn optional_env_path(keys: &[&str]) -> Option<std::path::PathBuf> {
    keys.iter()
        .find_map(|key| {
            std::env::var(key)
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
        })
        .map(std::path::PathBuf::from)
}

fn standard_app_storage_binding() -> Result<StandardDataRootBinding, String> {
    match optional_env_path(&[
        "NIMI_APP_DURABLE_DATA_ROOT",
        "NIMI_REALM_PERSONA_STUDIO_TAURI_DURABLE_DATA_ROOT",
        "NIMI_REALM_PERSONA_STUDIO_TAURI_STANDARD_DATA_ROOT",
    ]) {
        Some(durable_data_root) => Ok(StandardDataRootBinding::RuntimeLaunchProjection {
            cache_root: optional_env_path(&[
                "NIMI_APP_CACHE_ROOT",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_CACHE_ROOT",
            ])
            .or_else(|| Some(durable_data_root.clone())),
            temp_root: optional_env_path(&[
                "NIMI_APP_TEMP_ROOT",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_TEMP_ROOT",
            ])
            .or_else(|| Some(durable_data_root.clone())),
            durable_data_root,
            projection_ref: "realm-persona-studio-tauri-runtime-launch-projection".to_string(),
        }),
        None => Err(
            "Realm Persona Studio Tauri requires host-bound standard app storage roots".to_string(),
        ),
    }
}

fn resolve_standard_storage_slot() -> Result<StandardAppStorageRootSlot, String> {
    let roots = tauri::async_runtime::block_on(data::resolve_standard_app_storage_roots(
        standard_app_storage_binding()?,
    ))?;
    Ok(StandardAppStorageRootSlot::from_roots(roots))
}

fn resolve_installed_launch_binding_script() -> Result<String, String> {
    let binding = resolve_installed_nimi_app_launch_binding_from_env(
        InstalledNimiAppLaunchBindingEnvConfig {
            app_id: REALM_PERSONA_STUDIO_APP_ID,
            default_app_instance_id: REALM_PERSONA_STUDIO_RUNTIME_APP_INSTANCE_ID,
            default_device_id: REALM_PERSONA_STUDIO_RUNTIME_DEVICE_ID,
            default_release_descriptor_ref: REALM_PERSONA_STUDIO_RELEASE_DESCRIPTOR_REF,
            launch_host_id: DESKTOP_TAURI_INSTALLED_APP_LAUNCH_HOST_ID,
            launch_nonce_env_keys: &[
                "NIMI_APP_LAUNCH_NONCE",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_LAUNCH_NONCE",
            ],
            realm_base_url_env_keys: &[
                "NIMI_REALM_BASE_URL",
                "NIMI_REALM_URL",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_REALM_BASE_URL",
            ],
            app_instance_id_env_keys: &[
                "NIMI_APP_INSTANCE_ID",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_APP_INSTANCE_ID",
            ],
            device_id_env_keys: &[
                "NIMI_APP_DEVICE_ID",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_DEVICE_ID",
            ],
            release_descriptor_ref_env_keys: &[
                "NIMI_APP_RELEASE_DESCRIPTOR_REF",
                "NIMI_REALM_PERSONA_STUDIO_TAURI_RELEASE_DESCRIPTOR_REF",
            ],
        },
    )?;
    build_installed_nimi_app_launch_binding_script(&binding).map_err(|error| {
        format!("serialize Realm Persona Studio installed app launch binding: {error}")
    })
}

fn main() {
    load_dotenv_files();
    configure_runtime_bridge_env();
    session_logging::set_app_session_prefix("realm-persona-studio");
    session_logging::install_panic_hook();
    session_logging::log_boot_marker("realm-persona-studio main() entered");
    let launch_binding_script = resolve_installed_launch_binding_script()
        .expect("bind Realm Persona Studio installed app launch binding");

    tauri::Builder::default()
        .append_invoke_initialization_script(launch_binding_script)
        .manage(
            resolve_standard_storage_slot()
                .expect("bind Realm Persona Studio standard Runtime app storage roots"),
        )
        .invoke_handler(tauri::generate_handler![
            runtime::runtime_bridge_unary,
            runtime::runtime_bridge_stream_open,
            runtime::runtime_bridge_stream_close,
            data::data_path_resolve,
            storage::storage_read_json,
            storage::storage_write_json,
            storage::storage_remove_json,
            ai_config::ai_config_get,
            ai_config::ai_config_set,
            shell_ui::confirm_dialog,
            shell_ui::start_window_drag,
            shell_ui::focus_main_window,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Realm Persona Studio");
}
