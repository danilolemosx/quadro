//! Backend Tauri: comandos chamados pela interface (só por `ui/ponte.js`). A lógica fica no crate `motor`.

use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use tauri::menu::{Menu, MenuItemBuilder, MenuBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager, Wry};

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
    atualizar_menu(&app);
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

/// Durações em segundos reais (para os totais do rodapé e da lista). Inválidas viram 0.
#[tauri::command]
fn segundos(duracoes: Vec<String>, fps: String) -> R<Vec<f64>> {
    let fps = motor::timecode::Fps::ler(&fps).map_err(erro)?;
    Ok(duracoes.iter().map(|d| motor::timecode::segundos(d, fps).unwrap_or(0.0)).collect())
}

#[tauri::command]
fn detectar_cenas(linhas: Vec<motor::roteiro::Linha>) -> Vec<motor::roteiro::Cabecalho> {
    motor::roteiro::detectar(&linhas)
}

#[tauri::command]
fn copiar_roteiro(caminho: String, origem: String) -> R<String> {
    motor::projeto::copiar_para(Path::new(&caminho), Path::new(&origem), "roteiro.pdf").map_err(erro)
}

#[tauri::command]
fn mostrar_no_finder(caminho: String) {
    let _ = tauri_plugin_opener::reveal_item_in_dir(caminho);
}

/// Menu do app. Cada item manda o seu id para a interface (evento "menu").
fn montar_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<Wry>> {
    let item = |id: &str, texto: &str, atalho: Option<&str>| {
        let mut b = MenuItemBuilder::with_id(id, texto);
        if let Some(a) = atalho {
            b = b.accelerator(a);
        }
        b.build(app)
    };
    let mut recentes = SubmenuBuilder::new(app, "Abrir recente");
    let lista = motor::recentes::ler(&arquivo_recentes(app));
    if lista.is_empty() {
        recentes = recentes.item(&MenuItemBuilder::with_id("nenhum", "Nenhum").enabled(false).build(app)?);
    }
    for p in &lista {
        let nome = Path::new(p).file_stem().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| p.clone());
        recentes = recentes.item(&item(&format!("recente:{p}"), &nome, None)?);
    }
    let arquivo = SubmenuBuilder::new(app, "Arquivo")
        .item(&item("novo", "Novo projeto…", Some("CmdOrCtrl+N"))?)
        .item(&item("abrir", "Abrir projeto…", Some("CmdOrCtrl+O"))?)
        .item(&recentes.build()?)
        .separator()
        .item(&item("salvar", "Salvar", Some("CmdOrCtrl+S"))?)
        .separator()
        .item(&item("importar", "Importar imagens…", Some("CmdOrCtrl+I"))?)
        .item(&item("roteiro", "Importar roteiro (PDF)…", None)?)
        .separator()
        .item(&item("finder", "Mostrar projeto no Finder", None)?)
        .build()?;
    let editar = SubmenuBuilder::new(app, "Editar")
        .item(&item("desfazer", "Desfazer", Some("CmdOrCtrl+Z"))?)
        .item(&item("refazer", "Refazer", Some("CmdOrCtrl+Shift+Z"))?)
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    let ver = SubmenuBuilder::new(app, "Visualizar")
        .item(&item("vista:quadro", "Quadro", Some("CmdOrCtrl+1"))?)
        .item(&item("vista:lista", "Lista", Some("CmdOrCtrl+2"))?)
        .item(&item("vista:roteiro", "Roteiro", Some("CmdOrCtrl+3"))?)
        .separator()
        .item(&item("buscar", "Buscar", Some("CmdOrCtrl+F"))?)
        .build()?;
    let janela = SubmenuBuilder::new(app, "Janela").minimize().maximize().separator().fullscreen().build()?;
    let mut menu = MenuBuilder::new(app);
    #[cfg(target_os = "macos")]
    {
        let quadro = SubmenuBuilder::new(app, "Quadro").about(None).separator().hide().hide_others().show_all().separator().quit().build()?;
        menu = menu.item(&quadro);
    }
    menu.items(&[&arquivo, &editar, &ver, &janela]).build()
}

fn atualizar_menu(app: &tauri::AppHandle) {
    let a = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Ok(m) = montar_menu(&a) {
            let _ = a.set_menu(m);
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .menu(montar_menu)
        .on_menu_event(|app, ev| {
            let _ = app.emit("menu", ev.id().0.clone());
        })
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
            segundos,
            detectar_cenas,
            copiar_roteiro,
            mostrar_no_finder
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo");
}
