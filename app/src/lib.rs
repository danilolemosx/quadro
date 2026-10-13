//! Backend Tauri: comandos chamados pela interface (só por `ui/ponte.js`). A lógica fica no crate `motor`.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use tauri::Manager;

type R<T> = Result<T, String>;

fn erro(e: anyhow::Error) -> String {
    format!("{e:#}")
}

#[derive(Serialize)]
struct Aberto {
    caminho: String,
    projeto: Value,
}

fn arquivo_recentes(app: &tauri::AppHandle) -> PathBuf {
    app.path().app_config_dir().unwrap_or_else(|_| std::env::temp_dir()).join("recentes.json")
}

/// Projeto passado na linha de comando (por exemplo, "Abrir com…" ou duplo clique).
#[tauri::command]
fn projeto_inicial() -> Option<String> {
    std::env::args().skip(1).map(PathBuf::from).find(|p| p.join(motor::projeto::ARQUIVO).exists() || p.ends_with(motor::projeto::ARQUIVO)).map(|p| motor::projeto::pasta_do_projeto(&p).to_string_lossy().to_string())
}

#[tauri::command]
fn recentes(app: tauri::AppHandle) -> Vec<String> {
    motor::recentes::ler(&arquivo_recentes(&app))
}

#[tauri::command]
fn novo_projeto(app: tauri::AppHandle, pasta: String, nome: String) -> R<Aberto> {
    let p = motor::projeto::criar(Path::new(&pasta), &nome).map_err(erro)?;
    abrir_projeto(app, p.to_string_lossy().to_string())
}

#[tauri::command]
fn abrir_projeto(app: tauri::AppHandle, caminho: String) -> R<Aberto> {
    let pasta = motor::projeto::pasta_do_projeto(Path::new(&caminho));
    let projeto = motor::projeto::abrir(&pasta).map_err(erro)?;
    let caminho = pasta.to_string_lossy().to_string();
    let _ = motor::recentes::adicionar(&arquivo_recentes(&app), &caminho);
    Ok(Aberto { caminho, projeto })
}

#[tauri::command]
async fn salvar_projeto(caminho: String, projeto: Value) -> R<()> {
    tauri::async_runtime::spawn_blocking(move || motor::projeto::salvar(Path::new(&caminho), &projeto).map_err(erro))
        .await
        .map_err(|e| e.to_string())?
}

/// Copia a imagem para o projeto como frame da cena `id` (em outra thread: decodificar TIFF grande demora).
#[tauri::command]
async fn importar_frame(caminho: String, origem: String, id: String) -> R<motor::frames::Frame> {
    tauri::async_runtime::spawn_blocking(move || motor::frames::importar(Path::new(&caminho), Path::new(&origem), &id).map_err(erro))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
fn apagar_frame(caminho: String, id: String) -> R<()> {
    motor::frames::apagar(Path::new(&caminho), &id).map_err(erro)
}

#[tauri::command]
fn eh_imagem(caminho: String) -> bool {
    motor::frames::eh_imagem(Path::new(&caminho))
}

#[tauri::command]
fn numero_do_arquivo(nome: String, existentes: Vec<String>) -> Option<String> {
    motor::frames::numero_do_arquivo(&nome, &existentes)
}

#[tauri::command]
fn duracao(entrada: String, saida: String, fps: String) -> R<String> {
    let fps = motor::timecode::Fps::ler(&fps).map_err(erro)?;
    motor::timecode::duracao(&entrada, &saida, fps).map_err(erro)
}

/// Soma de durações em segundos reais (para o rodapé). Durações inválidas são ignoradas.
#[tauri::command]
fn somar_duracoes(duracoes: Vec<String>, fps: String) -> R<f64> {
    let fps = motor::timecode::Fps::ler(&fps).map_err(erro)?;
    Ok(duracoes.iter().filter_map(|d| motor::timecode::segundos(d, fps).ok()).sum())
}

#[tauri::command]
fn detectar_cenas(linhas: Vec<motor::roteiro::Linha>) -> Vec<motor::roteiro::Cabecalho> {
    motor::roteiro::detectar(&linhas)
}

#[tauri::command]
fn copiar_roteiro(caminho: String, origem: String) -> R<String> {
    motor::projeto::copiar_para(Path::new(&caminho), Path::new(&origem), "roteiro.pdf").map_err(erro)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            projeto_inicial,
            recentes,
            novo_projeto,
            abrir_projeto,
            salvar_projeto,
            importar_frame,
            apagar_frame,
            eh_imagem,
            numero_do_arquivo,
            duracao,
            somar_duracoes,
            detectar_cenas,
            copiar_roteiro
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo");
}
