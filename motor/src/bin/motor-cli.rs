//! Linha de comando do motor, para testar sem a interface:
//!   motor-cli novo <pasta> <nome>              cria <pasta>/<nome>.quadro
//!   motor-cli frame <projeto> <imagem> [id]    importa a imagem como frame (id: cNN pelo nome do arquivo)
//!   motor-cli tc <entrada> <saida> [fps]       duração entre dois timecodes (fps padrão 23.976)
//!   motor-cli roteiro <texto.txt>              cabeçalhos de cena (páginas separadas por \f)

use std::path::Path;
use std::process::ExitCode;

use anyhow::{bail, Result};

fn executar(args: &[String]) -> Result<()> {
    let a = |i: usize| args.get(i).map(String::as_str);
    match (a(0), a(1), a(2)) {
        (Some("novo"), Some(pasta), Some(nome)) => {
            println!("{}", motor::projeto::criar(Path::new(pasta), nome)?.display());
        }
        (Some("frame"), Some(projeto), Some(imagem)) => {
            let id = match a(3) {
                Some(id) => id.to_string(),
                None => match motor::frames::numero_do_arquivo(imagem, &[]) {
                    Some(n) => format!("c{n}"),
                    None => bail!("não achei o número da cena em {imagem}; passe o id"),
                },
            };
            let f = motor::frames::importar(Path::new(projeto), Path::new(imagem), &id)?;
            println!("{id}: {} ({}×{}), miniatura {}", f.frame, f.largura, f.altura, f.mini);
        }
        (Some("tc"), Some(entrada), Some(saida)) => {
            let fps = motor::timecode::Fps::ler(a(3).unwrap_or("23.976"))?;
            println!("{}", motor::timecode::duracao(entrada, saida, fps)?);
        }
        (Some("roteiro"), Some(arquivo), _) => {
            let texto = std::fs::read_to_string(arquivo)?;
            let linhas: Vec<motor::roteiro::Linha> = texto
                .split('\u{c}')
                .enumerate()
                .flat_map(|(p, pag)| pag.lines().map(move |t| motor::roteiro::Linha { pagina: p as u32 + 1, texto: t.to_string() }))
                .collect();
            let cabs = motor::roteiro::detectar(&linhas);
            for c in &cabs {
                println!("p.{:<4} {:>5}  {}", c.pagina, c.numero.as_deref().unwrap_or("?"), c.texto);
            }
            println!("{} cenas", cabs.len());
        }
        _ => bail!("uso: motor-cli novo|frame|tc|roteiro … (veja o começo de motor-cli.rs)"),
    }
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match executar(&args) {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("ERRO: {e:#}");
            ExitCode::FAILURE
        }
    }
}
