// Tauri falso para testar a interface no navegador, sem o app, com um projeto de 143 cenas.
// Cena pela URL: ?cena=quadro | materiais | importar | lista | roteiro | busca | inicio | vazio | plano
"use strict";
(function () {
  const cena = new URLSearchParams(location.search).get("cena") || "quadro";
  const erros = [];
  const marcarErros = () => (document.documentElement.dataset.erros = erros.join(" | ") || "nenhum");
  addEventListener("error", (e) => { erros.push(String(e.message)); marcarErros(); });
  addEventListener("unhandledrejection", (e) => { erros.push("promise: " + String(e.reason && e.reason.message || e.reason)); marcarErros(); });
  window.__ERROS__ = erros;

  // ---------- projeto de exemplo ----------
  let semente = 7;
  const rnd = () => ((semente = (semente * 16807) % 2147483647) / 2147483647);
  const pega = (xs) => xs[Math.floor(rnd() * xs.length)];
  const PESSOAS = ["Ana", "Bruno", "Carla", "Davi", "Elisa", "Fábio", "Gustavo", "Hugo", "Irene", "Jonas", "Lia", "Mauro"];
  const ACOES = ["chega à delegacia", "recebe um telefonema", "encontra uma vala", "come em silêncio no hospital", "liga para negociar", "corta os fios do orelhão", "lidera a operação", "vê o carro chegar", "conduz o refém", "é observado de longe", "insiste em ir junto", "esconde a foto", "discute com o chefe", "volta para casa"];
  const PARTES = [["O sequestro", 8], ["A negociação", 7], ["A operação", 5], ["O cerco", 41], ["A fuga", 42], ["O fim", 40]];
  const CORES = ["#f28cb1", "#f5b98c", "#7cc4ea", "#b99be6", "#f3e36a", "#a6dc8a"];
  const NUMEROS = ["05", "07", "08", "09", "11", "15D", "19", "20", "28PT", "31BDEG", "31CFH", "32", "40", "41", "42", "44", "44A", "45", "56", "58"];
  const RESUMOS = {
    "41": ["Gustavo impede Hugo ir na operação para realizar outro serviço.", ["Gustavo", "Hugo"], "montada", "00:41:12:00", "00:42:54:00", "Testar começar no close do Hugo. Ver com a direção se a foto aparece antes."],
  };
  function projetoExemplo() {
    const p = { formato: "quadro", versao: 1, nome: "Meu Filme", corte: "corte 3", material: "aco", opcoes: { sombra: true, grade: false }, fps: "23.976", partes: [], cenas: {} };
    let k = 0, n = 60;
    PARTES.forEach(([titulo, qtd], i) => {
      const parte = { id: "p" + (i + 1), nome: "Parte " + (i + 1), titulo, cor: CORES[i], cenas: [] };
      for (let j = 0; j < qtd; j++) {
        const numero = NUMEROS[k++] || String(n++);
        const id = "c" + numero;
        const pessoas = [...new Set([pega(PESSOAS), pega(PESSOAS)])].slice(0, 1 + Math.floor(rnd() * 2));
        const r = RESUMOS[numero];
        const seg = 40 + Math.floor(rnd() * 200);
        const st = rnd();
        p.cenas[id] = r
          ? { numero, resumo: r[0], personagens: r[1], status: r[2], entrada: r[3], saida: r[4], duracao: "00:01:42:00", notas: r[5], postits: [] }
          : {
              numero, resumo: `${pessoas.join(" e ")} ${pega(ACOES)}.`, personagens: pessoas,
              status: st < 0.7 ? "montada" : st < 0.88 ? "ajuste" : "falta",
              duracao: `00:${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}:00`, postits: [],
            };
        if (rnd() < 0.93) Object.assign(p.cenas[id], { frame: `frames/${id}.jpg`, mini: `frames/mini/${id}.jpg` });
        parte.cenas.push(id);
      }
      p.partes.push(parte);
    });
    p.cenas.c09.postits.push({ id: "n1", texto: "trocar plano?", cor: "#f6e35d" });
    p.cenas.c32.postits.push({ id: "n2", texto: "som direto", cor: "#f6e35d" });
    p.cenas.c45.postits.push({ id: "n3", texto: "encurtar", cor: "#f6e35d" });
    return p;
  }

  // ---------- frames falsos (SVG) ----------
  function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
  function frameFalso(caminho) {
    const h = hash(caminho);
    const x = 20 + (h % 60), y = 25 + ((h >> 8) % 40), sx = 25 + ((h >> 16) % 50);
    const quente = ["#c98a5a", "#d9a46b", "#b8755a", "#e0b080"][h % 4];
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 100' preserveAspectRatio='xMidYMid slice'>
      <defs><radialGradient id='l' cx='${x}%' cy='${y}%' r='45%'><stop offset='0' stop-color='${quente}'/><stop offset='1' stop-color='#1b1612'/></radialGradient></defs>
      <rect width='240' height='100' fill='url(#l)'/><g fill='#0b0908'><ellipse cx='${sx * 2.4}' cy='58' rx='9' ry='11'/><path d='M${sx * 2.4 - 20} 100 Q${sx * 2.4 - 18} 70 ${sx * 2.4} 68 Q${sx * 2.4 + 18} 70 ${sx * 2.4 + 20} 100Z'/></g></svg>`;
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  // ---------- comandos ----------
  let projeto = cena === "vazio" ? { formato: "quadro", versao: 1, nome: "Projeto Novo", corte: "", material: "aco", opcoes: { sombra: true, grade: false }, fps: "23.976", partes: [{ id: "p1", nome: "Parte 1", titulo: "", cor: "#f28cb1", cenas: [] }], cenas: {} } : projetoExemplo();
  if (cena === "plano") projeto.opcoes = { sombra: false, grade: true };
  const CAMINHO = "/Users/teste/Filmes/Meu Filme.quadro";
  const tcQ = (tc) => { const [h, m, s, q] = tc.split(/[:;]/).map(Number); return ((h * 60 + m) * 60 + s) * 24 + q; };
  const qTc = (n) => [Math.floor(n / 86400), Math.floor(n / 1440) % 60, Math.floor(n / 24) % 60, n % 24].map((v) => String(v).padStart(2, "0")).join(":");

  async function invoke(cmd, a) {
    switch (cmd) {
      case "projeto_inicial": return null;
      case "recentes": return cena === "inicio" ? [CAMINHO, "/Users/teste/Filmes/Curta 2025.quadro"] : [CAMINHO];
      case "abrir_projeto": return { caminho: CAMINHO, projeto: JSON.parse(JSON.stringify(projeto)) };
      case "novo_projeto": return { caminho: a.pasta + "/" + a.nome + ".quadro", projeto: { formato: "quadro", nome: a.nome, partes: [], cenas: {} } };
      case "salvar_projeto": projeto = a.projeto; return null;
      case "importar_frame": return { frame: `frames/${a.id}.jpg`, mini: `frames/mini/${a.id}.jpg`, largura: 1920, altura: 1080 };
      case "numero_do_arquivo": { const m = /(?:cena|sc)?[ _.-]*0*(\d{1,4})([a-z]?)(?![a-z])/i.exec(a.nome.replace(/\.[^.]+$/, "")); return m ? m[1] + m[2].toUpperCase() : null; }
      case "duracao": return qTc(tcQ(a.saida) - tcQ(a.entrada));
      case "segundos": return a.duracoes.map((d) => tcQ(d) / 23.976);
      case "detectar_cenas": {
        const out = [];
        a.linhas.forEach((l, i) => {
          const m = /^(\d{1,4}[A-Z]{0,2})\s+((?:INT|EXT)[./].*)$/.exec(l.texto);
          if (m) out.push({ numero: m[1], texto: m[2], pagina: l.pagina, linha: i });
        });
        return out;
      }
      case "copiar_roteiro": return "roteiro.pdf";
      case "mostrar_no_finder": return null;
      default: throw new Error("comando desconhecido " + cmd);
    }
  }
  const nada = async () => () => {};
  window.__TAURI__ = {
    core: { invoke, convertFileSrc: (c) => (/roteiro\.pdf$/.test(c) ? "roteiro-teste.pdf" : /\.(jpe?g|png)$/.test(c) ? frameFalso(c) : c) },
    dialog: { open: async () => null, ask: async () => false, message: async (m) => console.log("aviso:", m) },
    event: { listen: nada },
    window: { getCurrentWindow: () => ({ setTitle: async () => {}, onCloseRequested: nada }) },
    webview: { getCurrentWebview: () => ({ onDragDropEvent: nada }) },
  };

  // ---------- montar a cena pedida ----------
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  addEventListener("load", async () => {
    await espera(150);
    try {
      if (cena === "inicio") { mostrarInicio(); }
      if (Q.p && cena !== "vazio") selecionar("c41", { rolar: false });
      if (cena === "materiais") $("#matBtn").click();
      if (cena === "importar") Importar.abrir();
      if (cena === "lista") trocarVista("lista");
      if (cena === "busca") { $("#buscaTexto").focus(); $("#buscaTexto").value = "Davi"; $("#buscaTexto").dispatchEvent(new Event("input")); }
      if (cena === "roteiro") { await Roteiro.importar("/Users/teste/roteiro-teste.pdf"); selecionar("c41"); }
      if (cena === "quadro" || cena === "plano") $("#vQuadro").scrollTop = 0;
    } catch (e) { erros.push(String(e)); }
    await espera(400);
    marcarErros();
    document.documentElement.dataset.pronto = "1";
  });
})();
