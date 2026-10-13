//! Cabeçalhos de cena no texto de um roteiro em PDF. A interface extrai as linhas do PDF (pdf.js) e manda
//! para cá. Tolerante a formatos diferentes:
//!   "41 INT. DELEGACIA – DIA", "41. EXT. RUA - NOITE 41", "CENA 41 – INT. DELEGACIA – DIA",
//!   "CENA 41", "SC. 41", "INT./EXT. CARRO – DIA", "I/E CARRO", "INTERIOR. CASA – NOITE".
//! Se nenhum cabeçalho tiver número, numera em sequência (1, 2, 3…).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
pub struct Linha {
    pub pagina: u32,
    pub texto: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct Cabecalho {
    /// Número da cena ("41", "41A"); `None` quando o roteiro mistura cenas com e sem número.
    pub numero: Option<String>,
    /// O cabeçalho sem o número, ex.: "INT. DELEGACIA – DIA".
    pub texto: String,
    pub pagina: u32,
    /// Índice da linha na lista recebida.
    pub linha: usize,
}

const LOCAIS: [&str; 10] = ["INT./EXT", "EXT./INT", "INT/EXT", "EXT/INT", "I/E", "E/I", "INTERIOR", "EXTERIOR", "INT", "EXT"];

/// Lê um número de cena no começo de `s` ("41", "41A", "041.", "41-A"). Devolve (número, resto).
fn numero_no_inicio(s: &str) -> Option<(String, &str)> {
    let dig: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
    if dig.is_empty() || dig.len() > 4 {
        return None;
    }
    let mut resto = &s[dig.len()..];
    let mut num = dig.trim_start_matches('0').to_string();
    if num.is_empty() {
        num = "0".into();
    }
    // sufixo de uma ou duas letras: 41A, 41-A, 41 A, 41AB (seguido de separador)
    let r2 = resto.strip_prefix('-').unwrap_or(resto);
    if let Some(sem_espaco) = r2.strip_prefix(' ') {
        // "10 A EXT. …": uma letra sozinha depois do espaço é o sufixo da cena
        let mut cs = sem_espaco.chars();
        if let (Some(l), depois) = (cs.next(), cs.as_str()) {
            if l.is_ascii_uppercase() && (depois.is_empty() || depois.starts_with([' ', '.', '-', '–', '—', ':'])) {
                num.push(l);
                return Some((num, depois));
            }
        }
    }
    let letras: String = r2.chars().take_while(|c| c.is_ascii_alphabetic()).collect();
    if (1..=2).contains(&letras.len()) {
        let depois = &r2[letras.len()..];
        if depois.is_empty() || depois.starts_with(|c: char| !c.is_alphanumeric()) {
            num.push_str(&letras.to_uppercase());
            resto = depois;
        }
    }
    if resto.starts_with(|c: char| c.is_alphanumeric()) {
        return None; // "41ANOS"
    }
    Some((num, resto))
}

fn sem_separadores(s: &str) -> &str {
    s.trim_start_matches(|c: char| c.is_whitespace() || ".:-–—)".contains(c))
}

fn eh_local(s: &str) -> bool {
    let u = s.to_uppercase();
    LOCAIS.iter().any(|l| {
        u.strip_prefix(l).is_some_and(|depois| depois.is_empty() || depois.starts_with(['.', ' ', '/', '-', '–', '—', ':']))
    })
}

fn quase_tudo_maiusculo(s: &str) -> bool {
    let letras: Vec<char> = s.chars().filter(|c| c.is_alphabetic()).collect();
    if letras.is_empty() {
        return false;
    }
    letras.iter().filter(|c| c.is_uppercase()).count() * 10 >= letras.len() * 7
}

/// Tira um número repetido no fim ("INT. RUA – DIA 41").
fn numero_no_fim(s: &str) -> (Option<String>, String) {
    let t = s.trim_end();
    // "… DIA 10 A": número e letra separados no fim
    let palavras: Vec<&str> = t.rsplitn(3, char::is_whitespace).collect();
    if palavras.len() == 3 && palavras[0].len() == 1 && palavras[0].chars().all(|c| c.is_ascii_uppercase()) && !palavras[1].is_empty() && palavras[1].chars().all(|c| c.is_ascii_digit()) && palavras[1].len() <= 4 {
        return (Some(format!("{}{}", palavras[1].trim_start_matches('0'), palavras[0])), palavras[2].trim_end().to_string());
    }
    if let Some(pos) = t.rfind(char::is_whitespace) {
        if let Some((n, resto)) = numero_no_inicio(t[pos..].trim()) {
            if resto.trim_matches(|c: char| c == '.' || c == '*').is_empty() {
                return (Some(n), t[..pos].trim_end().to_string());
            }
        }
    }
    (None, t.to_string())
}

/// Analisa uma linha; devolve (número, texto do cabeçalho) se for cabeçalho de cena.
pub fn analisar(linha: &str) -> Option<(Option<String>, String)> {
    let s = linha.trim().trim_start_matches('*').trim();
    if s.is_empty() || s.chars().count() > 120 {
        return None;
    }
    let u = s.to_uppercase();
    // "CENA 41 …", "SC. 41 …", "SCENE 41"
    for chave in ["CENA", "SCENE", "SC.", "SC"] {
        if let Some(depois) = u.strip_prefix(chave) {
            let depois_orig = &s[s.len() - depois.len()..];
            let d = depois_orig.trim_start_matches(|c: char| c.is_whitespace() || c == '.' || c == ':' || c == 'º' || c == '°');
            if d.len() == depois_orig.len() && chave != "SC." {
                continue; // "CENARIO", "SCRIPT"
            }
            if let Some((n, resto)) = numero_no_inicio(d) {
                let resto = sem_separadores(resto);
                if resto.is_empty() || eh_local(resto) || quase_tudo_maiusculo(resto) {
                    let (_, texto) = numero_no_fim(resto);
                    return Some((Some(n), texto));
                }
            }
            return None;
        }
    }
    // "41 INT. …" / "41. EXT. …" / "5 STOCKSHOT NOITE EM JERUSALÉM" (número + texto em maiúsculas)
    if let Some((n, resto)) = numero_no_inicio(s) {
        let resto = sem_separadores(resto);
        let letras = resto.chars().filter(|c| c.is_alphabetic()).count();
        if (eh_local(resto) || letras >= 4) && quase_tudo_maiusculo(resto) {
            let (_, texto) = numero_no_fim(resto);
            return Some((Some(n), texto));
        }
        return None;
    }
    // "INT. DELEGACIA – DIA" (com número no fim ou sem número)
    if eh_local(s) && quase_tudo_maiusculo(s) {
        let (n, texto) = numero_no_fim(s);
        return Some((n, texto));
    }
    None
}

pub fn detectar(linhas: &[Linha]) -> Vec<Cabecalho> {
    let mut cabs: Vec<Cabecalho> = linhas
        .iter()
        .enumerate()
        .filter_map(|(i, l)| analisar(&l.texto).map(|(numero, texto)| Cabecalho { numero, texto, pagina: l.pagina, linha: i }))
        .collect();
    // "CENA 41" sozinho numa linha e o local na linha seguinte: junta os dois.
    let mut i = 0;
    while i + 1 < cabs.len() {
        if cabs[i].texto.is_empty() && cabs[i + 1].numero.is_none() && cabs[i + 1].linha <= cabs[i].linha + 2 {
            let prox = cabs.remove(i + 1);
            cabs[i].texto = prox.texto;
        }
        i += 1;
    }
    if cabs.iter().all(|c| c.numero.is_none()) {
        for (k, c) in cabs.iter_mut().enumerate() {
            c.numero = Some((k + 1).to_string());
        }
    }
    cabs
}

#[cfg(test)]
mod testes {
    use super::*;

    fn n(s: &str) -> Option<(Option<String>, String)> {
        analisar(s)
    }
    fn com(num: &str, t: &str) -> Option<(Option<String>, String)> {
        Some((Some(num.into()), t.into()))
    }

    #[test]
    fn formatos() {
        assert_eq!(n("41 INT. DELEGACIA – DIA"), com("41", "INT. DELEGACIA – DIA"));
        assert_eq!(n("41. EXT. RUA - NOITE 41"), com("41", "EXT. RUA - NOITE"));
        assert_eq!(n("CENA 41 – INT. DELEGACIA – DIA"), com("41", "INT. DELEGACIA – DIA"));
        assert_eq!(n("CENA 41"), com("41", ""));
        assert_eq!(n("Cena 7: EXT. PRAIA - DIA"), com("7", "EXT. PRAIA - DIA"));
        assert_eq!(n("SC. 12A INT. CARRO"), com("12A", "INT. CARRO"));
        assert_eq!(n("12A INT./EXT. CARRO – DIA"), com("12A", "INT./EXT. CARRO – DIA"));
        assert_eq!(n("041 - INT. CASA - NOITE"), com("41", "INT. CASA - NOITE"));
        assert_eq!(n("INT./EXT. CARRO – DIA"), Some((None, "INT./EXT. CARRO – DIA".into())));
        assert_eq!(n("I/E CARRO - NOITE"), Some((None, "I/E CARRO - NOITE".into())));
        assert_eq!(n("INTERIOR. CASA – NOITE 3"), com("3", "INTERIOR. CASA – NOITE"));
        assert_eq!(n("*41 INT. DELEGACIA – DIA*"), com("41", "INT. DELEGACIA – DIA*"));
        assert_eq!(n("10 A EXT. GALILEIA. MAR - NOITE"), com("10A", "EXT. GALILEIA. MAR - NOITE"));
        assert_eq!(n("10 A. EXT. GALILEIA - DIA 10 A"), com("10A", "EXT. GALILEIA - DIA"));
        assert_eq!(n("EXT. GALILEIA - DIA 10 A"), com("10A", "EXT. GALILEIA - DIA"));
        assert_eq!(n("CENA 10 A – INT. CASA"), com("10A", "INT. CASA"));
        assert_eq!(n("5 STOCKSHOT NOITE EM JERUSALÉM"), com("5", "STOCKSHOT NOITE EM JERUSALÉM"));
        assert_eq!(n("5. STOCKSHOT - NOITE EM JERUSALÉM 5"), com("5", "STOCKSHOT - NOITE EM JERUSALÉM"));
    }

    #[test]
    fn nao_sao_cabecalhos() {
        for l in [
            "Benício entra na delegacia.",
            "Interior da casa, tudo escuro.",
            "41 anos depois.",
            "3 homens entram na sala.",
            "12.",
            "38.",
            "2 OK",
            "Na cena 41 ele volta.",
            "CENÁRIO: uma rua",
            "CORTA PARA:",
            "BENÍCIO",
            "(baixo) Integralmente.",
            "INTERNO",
            "12",
            "",
        ] {
            assert_eq!(n(l), None, "{l}");
        }
    }

    #[test]
    fn detecta_em_sequencia() {
        let ls = |xs: &[&str]| xs.iter().enumerate().map(|(i, t)| Linha { pagina: 1 + i as u32 / 3, texto: t.to_string() }).collect::<Vec<_>>();
        let c = detectar(&ls(&["CENA 1", "INT. CASA – DIA", "Ana acorda.", "CENA 2 – EXT. RUA – NOITE", "Chove."]));
        assert_eq!(c.len(), 2);
        assert_eq!(c[0].numero.as_deref(), Some("1"));
        assert_eq!(c[0].texto, "INT. CASA – DIA");
        assert_eq!(c[1].numero.as_deref(), Some("2"));
        assert_eq!(c[1].pagina, 2);
        let c = detectar(&ls(&["INT. CASA – DIA", "Ana acorda.", "EXT. RUA – NOITE"]));
        assert_eq!(c.iter().map(|c| c.numero.clone().unwrap()).collect::<Vec<_>>(), ["1", "2"]);
    }
}
