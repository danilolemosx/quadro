//! O projeto é uma pasta `Nome.quadro/` com `projeto.json` (tudo, em texto legível), `frames/` (imagens dos
//! cartões) e, opcionalmente, `roteiro.pdf`. O conteúdo do JSON é da interface: o motor só confere que é um
//! projeto do Quadro e grava com segurança (arquivo temporário e depois renomear, guardando o anterior em .bak).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{bail, Context, Result};
use serde_json::{json, Value};

pub const ARQUIVO: &str = "projeto.json";
pub const EXTENSAO: &str = "quadro";

/// JSON de um projeto novo e vazio, com uma parte.
pub fn novo_json(nome: &str) -> Value {
    json!({
        "formato": "quadro",
        "versao": 1,
        "nome": nome,
        "corte": "",
        "material": "aco",
        "opcoes": { "sombra": true, "grade": false },
        "fps": "23.976",
        "partes": [ { "id": "p1", "nome": "Parte 1", "titulo": "", "cor": "#f28cb1", "cenas": [] } ],
        "cenas": {}
    })
}

/// Aceita a pasta `Nome.quadro` ou o `projeto.json` dentro dela e devolve a pasta.
pub fn pasta_do_projeto(caminho: &Path) -> PathBuf {
    if caminho.file_name().is_some_and(|n| n == ARQUIVO) {
        caminho.parent().map(Path::to_path_buf).unwrap_or_default()
    } else {
        caminho.to_path_buf()
    }
}

/// Cria `pasta_pai/Nome.quadro/` com um projeto vazio. Não sobrescreve um projeto que já existe.
pub fn criar(pasta_pai: &Path, nome: &str) -> Result<PathBuf> {
    let nome = nome.trim();
    if nome.is_empty() {
        bail!("o projeto precisa de um nome");
    }
    let limpo: String = nome.chars().map(|c| if "/\\:*?\"<>|".contains(c) { '-' } else { c }).collect();
    let pasta = pasta_pai.join(format!("{limpo}.{EXTENSAO}"));
    if pasta.exists() {
        bail!("já existe um projeto com esse nome em {}", pasta_pai.display());
    }
    fs::create_dir_all(pasta.join("frames").join("mini")).with_context(|| format!("não foi possível criar {}", pasta.display()))?;
    salvar(&pasta, &novo_json(nome))?;
    Ok(pasta)
}

fn conferir(v: &Value) -> Result<()> {
    if v.get("formato").and_then(Value::as_str) != Some("quadro") {
        bail!("não é um projeto do Quadro");
    }
    Ok(())
}

/// Abre o projeto. Se o `projeto.json` estiver estragado, tenta a cópia anterior (`projeto.json.bak`).
pub fn abrir(caminho: &Path) -> Result<Value> {
    let pasta = pasta_do_projeto(caminho);
    let principal = pasta.join(ARQUIVO);
    let ler = |p: &Path| -> Result<Value> {
        let texto = fs::read_to_string(p).with_context(|| format!("não foi possível ler {}", p.display()))?;
        let v: Value = serde_json::from_str(&texto).with_context(|| format!("{} está estragado", p.display()))?;
        conferir(&v)?;
        Ok(v)
    };
    match ler(&principal) {
        Ok(v) => Ok(v),
        Err(e) => {
            let bak = pasta.join(format!("{ARQUIVO}.bak"));
            if bak.exists() {
                ler(&bak).map_err(|_| e)
            } else {
                Err(e)
            }
        }
    }
}

/// Grava o projeto com segurança: escreve num temporário, guarda o anterior em `.bak` e renomeia.
/// Se o app fechar no meio, o `projeto.json` antigo continua inteiro.
pub fn salvar(pasta: &Path, v: &Value) -> Result<()> {
    conferir(v)?;
    let pasta = pasta_do_projeto(pasta);
    fs::create_dir_all(pasta.join("frames").join("mini"))?;
    let destino = pasta.join(ARQUIVO);
    let tmp = pasta.join(format!("{ARQUIVO}.tmp"));
    let mut texto = serde_json::to_string_pretty(v)?;
    texto.push('\n');
    {
        let mut f = fs::File::create(&tmp).with_context(|| format!("não foi possível gravar em {}", pasta.display()))?;
        f.write_all(texto.as_bytes())?;
        f.sync_all()?;
    }
    if destino.exists() {
        let _ = fs::copy(&destino, pasta.join(format!("{ARQUIVO}.bak")));
    }
    fs::rename(&tmp, &destino).with_context(|| format!("não foi possível gravar {}", destino.display()))?;
    Ok(())
}

/// Copia um arquivo para dentro do projeto (ex.: o PDF do roteiro → `roteiro.pdf`).
pub fn copiar_para(pasta: &Path, origem: &Path, nome: &str) -> Result<String> {
    let pasta = pasta_do_projeto(pasta);
    let destino = pasta.join(nome);
    if fs::canonicalize(origem).ok() != fs::canonicalize(&destino).ok() {
        fs::copy(origem, &destino).with_context(|| format!("não foi possível copiar {}", origem.display()))?;
    }
    Ok(nome.to_string())
}

#[cfg(test)]
mod testes {
    use super::*;

    pub fn pasta_teste(nome: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("quadro-teste-{}-{nome}", std::process::id()));
        let _ = fs::remove_dir_all(&p);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn cria_abre_e_salva() {
        let base = pasta_teste("projeto");
        let p = criar(&base, "Meu Filme").unwrap();
        assert!(p.ends_with("Meu Filme.quadro"));
        assert!(p.join("frames/mini").is_dir());
        let mut v = abrir(&p).unwrap();
        assert_eq!(v["nome"], "Meu Filme");
        assert!(criar(&base, "Meu Filme").is_err(), "não pode sobrescrever");

        v["cenas"]["c41"] = json!({ "numero": "41", "resumo": "Benício impede Jailton" });
        salvar(&p.join(ARQUIVO), &v).unwrap();
        let v2 = abrir(&p.join(ARQUIVO)).unwrap();
        assert_eq!(v2["cenas"]["c41"]["resumo"], "Benício impede Jailton");
        assert!(!p.join("projeto.json.tmp").exists());
        assert!(p.join("projeto.json.bak").exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn recupera_do_bak() {
        let base = pasta_teste("bak");
        let p = criar(&base, "X").unwrap();
        let mut v = abrir(&p).unwrap();
        v["corte"] = json!("corte 2");
        salvar(&p, &v).unwrap();
        fs::write(p.join(ARQUIVO), "{ quebrado").unwrap();
        let v = abrir(&p).unwrap();
        assert_eq!(v["formato"], "quadro");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn recusa_o_que_nao_e_quadro() {
        let base = pasta_teste("outro");
        fs::write(base.join(ARQUIVO), r#"{"formato":"outro"}"#).unwrap();
        assert!(abrir(&base).is_err());
        assert!(salvar(&base, &json!({})).is_err());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn nome_com_barra() {
        let base = pasta_teste("barra");
        let p = criar(&base, "A/B").unwrap();
        assert!(p.ends_with("A-B.quadro"));
        assert_eq!(abrir(&p).unwrap()["nome"], "A/B");
        let _ = fs::remove_dir_all(&base);
    }
}
