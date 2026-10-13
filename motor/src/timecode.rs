//! Timecode (como no Decanta): 23,976 / 24 / 25 / 29,97 NDF e DF / 30, e também 50 / 59,94 / 60.
//! Drop frame usa ";" antes dos quadros (00:01:00;02).

use anyhow::{bail, Result};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Fps {
    /// Quadros por segundo "de contagem" (24, 25, 30, 60…).
    pub nominal: u32,
    pub drop: bool,
    /// Taxa real (23,976…), para converter em tempo.
    pub taxa: f64,
}

impl Fps {
    pub fn ler(texto: &str) -> Result<Fps> {
        let t = texto.trim().to_uppercase().replace(',', ".").replace(' ', "");
        let drop = t.ends_with("DF") && !t.ends_with("NDF");
        let num = t.trim_end_matches("NDF").trim_end_matches("DF");
        let (nominal, taxa) = match num {
            "23.976" | "23.98" => (24, 24000.0 / 1001.0),
            "24" => (24, 24.0),
            "25" => (25, 25.0),
            "29.97" => (30, 30000.0 / 1001.0),
            "30" => (30, 30.0),
            "50" => (50, 50.0),
            "59.94" => (60, 60000.0 / 1001.0),
            "60" => (60, 60.0),
            _ => bail!("taxa de quadros desconhecida: {texto}"),
        };
        if drop && nominal != 30 && nominal != 60 {
            bail!("drop frame só existe em 29,97 e 59,94");
        }
        Ok(Fps { nominal, drop, taxa })
    }

    fn pulo(&self) -> i64 {
        if self.drop { (self.nominal / 15) as i64 } else { 0 } // 2 em 29,97; 4 em 59,94
    }
}

/// "01:02:03:04" → quadros desde 00:00:00:00. Aceita ":", ";" ou "." como separadores.
pub fn para_quadros(tc: &str, fps: Fps) -> Result<i64> {
    let partes: Vec<&str> = tc.trim().split([':', ';', '.']).collect();
    if partes.len() != 4 {
        bail!("timecode inválido: {tc} (use HH:MM:SS:QQ)");
    }
    let mut n = [0i64; 4];
    for (i, p) in partes.iter().enumerate() {
        n[i] = p.trim().parse().map_err(|_| anyhow::anyhow!("timecode inválido: {tc}"))?;
    }
    let [h, m, s, q] = n;
    let fpsn = fps.nominal as i64;
    if m > 59 || s > 59 || q >= fpsn || h < 0 || m < 0 || s < 0 || q < 0 {
        bail!("timecode inválido: {tc}");
    }
    let minutos = h * 60 + m;
    let pulados = fps.pulo() * (minutos - minutos / 10);
    if fps.drop && s == 0 && q < fps.pulo() && m % 10 != 0 {
        bail!("timecode inválido em drop frame: {tc}");
    }
    Ok(((h * 3600 + m * 60 + s) * fpsn + q) - pulados)
}

/// Quadros → "HH:MM:SS:QQ" (";" antes dos quadros em drop frame). Negativos ganham "-".
pub fn de_quadros(quadros: i64, fps: Fps) -> String {
    let sinal = if quadros < 0 { "-" } else { "" };
    let mut n = quadros.abs();
    let fpsn = fps.nominal as i64;
    if fps.drop {
        let pulo = fps.pulo();
        let por10 = fpsn * 600 - pulo * 9;
        let por1 = fpsn * 60 - pulo;
        let d = n / por10;
        let r = n % por10;
        n += pulo * 9 * d + if r > pulo { pulo * ((r - pulo) / por1) } else { 0 };
    }
    let q = n % fpsn;
    let s = (n / fpsn) % 60;
    let m = (n / fpsn / 60) % 60;
    let h = n / fpsn / 3600;
    let sep = if fps.drop { ';' } else { ':' };
    format!("{sinal}{h:02}:{m:02}:{s:02}{sep}{q:02}")
}

/// Duração entre entrada e saída, como timecode.
pub fn duracao(entrada: &str, saida: &str, fps: Fps) -> Result<String> {
    let d = para_quadros(saida, fps)? - para_quadros(entrada, fps)?;
    if d < 0 {
        bail!("a saída vem antes da entrada");
    }
    Ok(de_quadros(d, fps))
}

/// Duração em segundos reais (para o total "1h 42min" do rodapé).
pub fn segundos(duracao_tc: &str, fps: Fps) -> Result<f64> {
    Ok(para_quadros(duracao_tc, fps)? as f64 / fps.taxa)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn ndf_ida_e_volta() {
        for f in ["23.976", "24", "25", "29.97", "30", "50", "59.94", "60"] {
            let fps = Fps::ler(f).unwrap();
            for tc in ["00:00:00:00", "00:41:12:00", "01:00:00:01", "10:59:59:00"] {
                assert_eq!(de_quadros(para_quadros(tc, fps).unwrap(), fps), tc, "{f} {tc}");
            }
        }
        let fps = Fps::ler("24").unwrap();
        assert_eq!(para_quadros("00:00:01:00", fps).unwrap(), 24);
        assert_eq!(para_quadros("01:00:00:00", fps).unwrap(), 86_400);
    }

    #[test]
    fn drop_frame() {
        let df = Fps::ler("29.97 DF").unwrap();
        assert!(df.drop);
        assert_eq!(para_quadros("00:01:00;02", df).unwrap(), 1800);
        assert_eq!(de_quadros(1800, df), "00:01:00;02");
        assert_eq!(de_quadros(1799, df), "00:00:59;29");
        assert_eq!(para_quadros("00:10:00;00", df).unwrap(), 17_982);
        assert_eq!(para_quadros("01:00:00;00", df).unwrap(), 107_892);
        for n in [0, 1, 1799, 1800, 17_981, 17_982, 17_983, 107_892, 2_000_000] {
            assert_eq!(para_quadros(&de_quadros(n, df), df).unwrap(), n, "{n}");
        }
        assert!(para_quadros("00:01:00;00", df).is_err());
        let df60 = Fps::ler("59,94DF").unwrap();
        assert_eq!(para_quadros("00:01:00;04", df60).unwrap(), 3600);
        assert!(Fps::ler("25DF").is_err());
    }

    #[test]
    fn duracoes() {
        let fps = Fps::ler("23.976").unwrap();
        assert_eq!(duracao("00:41:12:00", "00:42:54:00", fps).unwrap(), "00:01:42:00");
        assert!(duracao("00:42:00:00", "00:41:00:00", fps).is_err());
        assert!(para_quadros("00:00:00:24", fps).is_err());
        assert!(para_quadros("12:00", fps).is_err());
        let s = segundos("00:01:00:00", fps).unwrap();
        assert!((s - 60.06).abs() < 0.001);
    }
}
