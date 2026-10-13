//! Frames dos cartões: cada imagem importada vira `frames/<id>.jpg` (até 2560 px, para a ficha) e
//! `frames/mini/<id>.jpg` (480 px, para o quadro, que precisa aguentar ~200 cartões sem travar).
//! JPG, PNG, TIFF e WebP entram; tudo sai em JPEG, que a janela sempre consegue mostrar.

use std::fs;
use std::io::BufWriter;
use std::path::Path;

use anyhow::{bail, Context, Result};
use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::{DynamicImage, ImageReader};
use serde::Serialize;

use crate::projeto::pasta_do_projeto;

pub const LADO_MAX: u32 = 2560;
pub const LARGURA_MINI: u32 = 480;

#[derive(Debug, Clone, Serialize)]
pub struct Frame {
    /// Caminho relativo à pasta do projeto, ex.: `frames/c41.jpg`.
    pub frame: String,
    pub mini: String,
    pub largura: u32,
    pub altura: u32,
}

pub fn eh_imagem(caminho: &Path) -> bool {
    let ext = caminho.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "tif" | "tiff" | "webp")
}

fn id_seguro(id: &str) -> Result<&str> {
    if id.is_empty() || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        bail!("id de cena inválido: {id:?}");
    }
    Ok(id)
}

fn gravar_jpeg(img: &DynamicImage, destino: &Path, qualidade: u8) -> Result<()> {
    let tmp = destino.with_extension("tmp");
    {
        let f = fs::File::create(&tmp).with_context(|| format!("não foi possível gravar {}", destino.display()))?;
        let mut enc = JpegEncoder::new_with_quality(BufWriter::new(f), qualidade);
        enc.encode_image(&img.to_rgb8())?;
    }
    fs::rename(&tmp, destino)?;
    Ok(())
}

/// Copia a imagem `origem` para o projeto como frame da cena `id` (substitui o frame anterior).
pub fn importar(projeto: &Path, origem: &Path, id: &str) -> Result<Frame> {
    let id = id_seguro(id)?;
    let pasta = pasta_do_projeto(projeto);
    let img = ImageReader::open(origem)
        .with_context(|| format!("não foi possível abrir {}", origem.display()))?
        .with_guessed_format()?
        .decode()
        .with_context(|| format!("{} não é uma imagem que o Quadro consiga ler", origem.display()))?;
    let (l, a) = (img.width(), img.height());
    let grande = if l.max(a) > LADO_MAX { img.resize(LADO_MAX, LADO_MAX, FilterType::Lanczos3) } else { img.clone() };
    let mini = if l > LARGURA_MINI { img.resize(LARGURA_MINI, u32::MAX, FilterType::Triangle) } else { img };
    fs::create_dir_all(pasta.join("frames").join("mini"))?;
    let frame = format!("frames/{id}.jpg");
    let mini_rel = format!("frames/mini/{id}.jpg");
    gravar_jpeg(&grande, &pasta.join(&frame), 90)?;
    gravar_jpeg(&mini, &pasta.join(&mini_rel), 82)?;
    Ok(Frame { frame, mini: mini_rel, largura: grande.width(), altura: grande.height() })
}

/// Apaga o frame da cena `id` (quando a cena é apagada de vez).
pub fn apagar(projeto: &Path, id: &str) -> Result<()> {
    let id = id_seguro(id)?;
    let pasta = pasta_do_projeto(projeto);
    for p in [pasta.join(format!("frames/{id}.jpg")), pasta.join(format!("frames/mini/{id}.jpg"))] {
        if p.exists() {
            fs::remove_file(p)?;
        }
    }
    Ok(())
}

fn normalizar(n: &str) -> String {
    let n = n.to_uppercase();
    let t = n.trim_start_matches('0');
    if t.is_empty() || !t.starts_with(|c: char| c.is_ascii_digit()) { n } else { t.to_string() }
}

/// Acha o número da cena no nome de um arquivo: "CENA 41.jpg" → 41, "41.png" → 41, "cena_31B.jpg" → 31B.
/// Se as letras depois do número formarem uma cena que já existe (ex.: 31B), usa essa; senão, o número
/// com no máximo uma letra. Preferência para o número logo depois de "CENA", "SC" ou "SCENE".
pub fn numero_do_arquivo(nome: &str, existentes: &[String]) -> Option<String> {
    let base = Path::new(nome).file_stem()?.to_str()?.to_uppercase();
    let cs: Vec<char> = base.chars().collect();
    // todas as sequências de dígitos: (início, fim)
    let mut corridas = Vec::new();
    let mut i = 0;
    while i < cs.len() {
        if cs[i].is_ascii_digit() {
            let ini = i;
            while i < cs.len() && cs[i].is_ascii_digit() {
                i += 1;
            }
            corridas.push((ini, i));
        } else {
            i += 1;
        }
    }
    let antes = |ini: usize| -> String {
        let mut k = ini;
        while k > 0 && matches!(cs[k - 1], ' ' | '_' | '-' | '.') {
            k -= 1;
        }
        let mut j = k;
        while j > 0 && cs[j - 1].is_alphabetic() {
            j -= 1;
        }
        cs[j..k].iter().collect()
    };
    let &(ini, fim) = corridas
        .iter()
        .find(|(ini, _)| matches!(antes(*ini).as_str(), "CENA" | "SC" | "SCENE" | "CENAS"))
        .or_else(|| corridas.first())?;
    let digitos: String = cs[ini..fim].iter().collect();
    let digitos = normalizar(&digitos);
    if digitos.len() > 4 {
        return None; // IMG_20261013… não é número de cena
    }
    let mut letras = String::new();
    let mut k = fim;
    while k < cs.len() && cs[k].is_ascii_alphabetic() {
        letras.push(cs[k]);
        k += 1;
    }
    let existentes: Vec<String> = existentes.iter().map(|e| normalizar(e)).collect();
    for n in (0..=letras.len()).rev() {
        let cand = format!("{digitos}{}", &letras[..n]);
        if existentes.contains(&cand) {
            return Some(cand);
        }
    }
    if letras.len() == 1 { Some(format!("{digitos}{letras}")) } else { Some(digitos) }
}

#[cfg(test)]
mod testes {
    use super::*;

    fn v(xs: &[&str]) -> Vec<String> {
        xs.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn numeros_nos_nomes() {
        assert_eq!(numero_do_arquivo("CENA 41.jpg", &[]), Some("41".into()));
        assert_eq!(numero_do_arquivo("41.png", &[]), Some("41".into()));
        assert_eq!(numero_do_arquivo("cena_031.tif", &[]), Some("31".into()));
        assert_eq!(numero_do_arquivo("cena_31BDEG.jpg", &[]), Some("31".into()));
        assert_eq!(numero_do_arquivo("cena_31BDEG.jpg", &v(&["31B"])), Some("31B".into()));
        assert_eq!(numero_do_arquivo("cena 12a.jpg", &[]), Some("12A".into()));
        assert_eq!(numero_do_arquivo("filme_v3_CENA_7.png", &[]), Some("7".into()));
        assert_eq!(numero_do_arquivo("SC07_take2.jpg", &[]), Some("7".into()));
        assert_eq!(numero_do_arquivo("IMG_20261013.jpg", &[]), None);
        assert_eq!(numero_do_arquivo("frame.jpg", &[]), None);
    }

    #[test]
    fn importa_e_gera_miniatura() {
        let base = std::env::temp_dir().join(format!("quadro-frames-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let origem = base.join("CENA 41.png");
        let img = image::RgbImage::from_fn(1920, 1080, |x, y| image::Rgb([(x % 256) as u8, (y % 256) as u8, 90]));
        img.save(&origem).unwrap();
        let tif = base.join("cena 2.tif");
        img.save(&tif).unwrap();

        let f = importar(&base, &origem, "c41").unwrap();
        assert_eq!(f.frame, "frames/c41.jpg");
        assert_eq!((f.largura, f.altura), (1920, 1080));
        let mini = image::open(base.join(&f.mini)).unwrap();
        assert_eq!((mini.width(), mini.height()), (480, 270));
        assert!(importar(&base, &tif, "c2").is_ok());
        assert!(importar(&base, &origem, "../x").is_err());
        apagar(&base, "c41").unwrap();
        assert!(!base.join("frames/c41.jpg").exists());
        let _ = fs::remove_dir_all(&base);
    }
}
