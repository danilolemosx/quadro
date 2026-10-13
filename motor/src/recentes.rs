//! Lista de projetos recentes (os 10 últimos), guardada num JSON na pasta de configuração do app.

use std::fs;
use std::path::Path;

use anyhow::Result;

pub const MAX: usize = 10;

/// Lê a lista; os projetos que não existem mais saem dela.
pub fn ler(arquivo: &Path) -> Vec<String> {
    let lista: Vec<String> = fs::read_to_string(arquivo).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default();
    lista.into_iter().filter(|p| Path::new(p).join(crate::projeto::ARQUIVO).exists()).collect()
}

/// Põe `projeto` no topo da lista e grava.
pub fn adicionar(arquivo: &Path, projeto: &str) -> Result<Vec<String>> {
    let mut lista = ler(arquivo);
    lista.retain(|p| p != projeto);
    lista.insert(0, projeto.to_string());
    lista.truncate(MAX);
    if let Some(pai) = arquivo.parent() {
        fs::create_dir_all(pai)?;
    }
    fs::write(arquivo, serde_json::to_string_pretty(&lista)?)?;
    Ok(lista)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn topo_e_limpeza() {
        let base = std::env::temp_dir().join(format!("quadro-recentes-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let a = crate::projeto::criar(&base, "A").unwrap();
        let b = crate::projeto::criar(&base, "B").unwrap();
        let arq = base.join("conf/recentes.json");
        let (a, b) = (a.to_string_lossy().to_string(), b.to_string_lossy().to_string());
        adicionar(&arq, &a).unwrap();
        adicionar(&arq, &b).unwrap();
        assert_eq!(adicionar(&arq, &a).unwrap(), vec![a.clone(), b.clone()]);
        fs::remove_dir_all(&b).unwrap();
        assert_eq!(ler(&arq), vec![a]);
        let _ = fs::remove_dir_all(&base);
    }
}
