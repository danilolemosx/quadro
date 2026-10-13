// Visão Roteiro (só leitura): o texto do PDF formatado em Courier Prime, com o cartão da cena na margem.
// O pdf.js vai empacotado no app (ui/pdfjs), sem internet. A detecção das cenas é do motor.
"use strict";

const Roteiro = (() => {
  let lib = null;
  let doc = null; // { chave, paginas: [[{ t, recuo }]], linhas: [{ pagina, texto }] }
  let montado = null; // chave do que está desenhado
  let carregando = null;
  let erro = null;
  let semRolar = false;

  async function pdfjs() {
    if (!lib) {
      lib = await import("./pdfjs/pdf.min.mjs");
      lib.GlobalWorkerOptions.workerSrc = "./pdfjs/pdf.worker.min.mjs";
    }
    return lib;
  }
  const mediana = (xs, padrao) => {
    if (!xs.length) return padrao;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  /** Lê o PDF e remonta as linhas com o recuo original (o roteiro é em fonte monoespaçada). */
  async function extrair(url) {
    const pdf = await (await pdfjs()).getDocument({ url, isEvalSupported: false }).promise;
    const brutas = []; // por página: [{ y, x, itens }]
    let letras = 0;
    const largurasChar = [], alturas = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const pg = await pdf.getPage(n);
      const tc = await pg.getTextContent();
      const linhas = [];
      for (const it of tc.items) {
        if (!("str" in it) || !it.str) continue;
        const x = it.transform[4], y = it.transform[5];
        letras += it.str.trim().length;
        if (it.str.trim().length >= 4 && it.width > 0) largurasChar.push(it.width / it.str.length);
        let l = linhas.find((r) => Math.abs(r.y - y) < 2.5);
        if (!l) { l = { y, itens: [] }; linhas.push(l); }
        l.itens.push({ x, w: it.width, s: it.str });
      }
      linhas.sort((a, b) => b.y - a.y);
      for (let i = 1; i < linhas.length; i++) alturas.push(linhas[i - 1].y - linhas[i].y);
      brutas.push(linhas);
    }
    const cw = mediana(largurasChar, 7.2);
    const lh = mediana(alturas.filter((h) => h > 4), 14);
    let margem = Infinity;
    for (const pg of brutas) for (const l of pg) {
      l.itens.sort((a, b) => a.x - b.x);
      margem = Math.min(margem, l.itens[0].x);
    }
    const paginas = [], linhas = [];
    brutas.forEach((pg, n) => {
      const saida = [];
      let yAnt = null;
      for (const l of pg) {
        if (yAnt !== null) {
          const vazias = Math.min(2, Math.round((yAnt - l.y) / lh) - 1);
          for (let k = 0; k < vazias; k++) saida.push({ t: "", recuo: 0 });
        }
        yAnt = l.y;
        let t = "", fim = null;
        for (const it of l.itens) {
          if (fim !== null) {
            const gap = it.x - fim;
            if (gap > cw * 0.6 && !t.endsWith(" ") && !it.s.startsWith(" ")) t += " ".repeat(Math.max(1, Math.round(gap / cw)));
          }
          t += it.s;
          fim = it.x + it.w;
        }
        const recuo = Math.max(0, Math.round((l.itens[0].x - margem) / cw));
        saida.push({ t: t.replace(/\s+$/, ""), recuo, i: linhas.length });
        linhas.push({ pagina: n + 1, texto: t.trim() });
      }
      paginas.push(saida);
    });
    return { paginas, linhas, escaneado: letras < 40 * pdf.numPages };
  }

  const urlPdf = () => Ponte.url(Ponte.junta(Q.caminho, Q.p.roteiro.arquivo || "roteiro.pdf")) + "?v=" + (Q.p.roteiro.importado || 0);
  const chaveAtual = () => Q.caminho + "|" + (Q.p.roteiro && Q.p.roteiro.importado);

  async function carregar() {
    const chave = chaveAtual();
    if (doc && doc.chave === chave) return doc;
    if (carregando && carregando.chave === chave) return carregando.p;
    erro = null;
    const p = extrair(urlPdf()).then((d) => (doc = { ...d, chave }));
    carregando = { chave, p };
    try { return await p; }
    catch (e) { erro = String(e && e.message || e); throw e; }
    finally { carregando = null; }
  }

  /** Importa o PDF: copia para o projeto, acha as cenas, liga aos cartões e oferece criar as que faltam. */
  async function importar(origem) {
    if (!Q.p) return;
    if (!origem) {
      [origem] = await Ponte.escolherArquivos("Importar roteiro", "PDF", ["pdf"], false);
      if (!origem) return;
    }
    trocarVista("roteiro");
    $("#vRoteiro").innerHTML = `<div class="vazio-r"><b>LENDO O ROTEIRO…</b>${esc(Ponte.nome(origem))}</div>`;
    let d, info;
    try {
      const arquivo = await Ponte.copiarRoteiro(Q.caminho, origem);
      info = { arquivo, nome: Ponte.nome(origem), importado: Date.now(), cenas: [] };
      d = await extrair(Ponte.url(Ponte.junta(Q.caminho, arquivo)) + "?v=" + info.importado);
    } catch (e) {
      desenhar();
      return Ponte.avisar("Não foi possível ler este PDF.\n\n" + e);
    }
    if (d.escaneado) {
      desenhar();
      return Ponte.avisar("Este PDF parece ser uma imagem escaneada: não tem texto para ler.\n\nExporte o roteiro de novo em PDF a partir do programa em que foi escrito (Final Draft, WriterDuet, Word…).");
    }
    const cabs = await Ponte.detectarCenas(d.linhas);
    info.cenas = cabs;
    doc = { ...d, chave: Q.caminho + "|" + info.importado };
    montado = null;
    mudar((p) => {
      p.roteiro = info;
      for (const cab of cabs) {
        const id = cab.numero && cenaPorNumero(cab.numero);
        if (id) p.cenas[id].roteiro = { pagina: cab.pagina };
      }
    });
    const faltam = cabs.filter((c) => c.numero && !cenaPorNumero(c.numero));
    const repetidas = new Set();
    const unicas = faltam.filter((c) => !repetidas.has(normNum(c.numero)) && repetidas.add(normNum(c.numero)));
    if (!cabs.length) {
      Ponte.avisar("Não achei cabeçalhos de cena neste roteiro (como \"41 INT. DELEGACIA – DIA\" ou \"CENA 41\").\n\nO texto aparece mesmo assim, mas sem ligação com os cartões.");
    } else if (unicas.length) {
      const n = unicas.length;
      const ok = await Ponte.perguntar(`${n} ${n === 1 ? "cena do roteiro não está" : "cenas do roteiro não estão"} no quadro. Criar?`, n === 1 ? "Criar cena" : `Criar ${n} cenas`, "Agora não");
      if (ok) mudar((p) => {
        for (const cab of unicas) {
          const id = novoId("c");
          p.cenas[id] = { numero: normNum(cab.numero), resumo: cab.texto || "", personagens: [], status: "", postits: [], roteiro: { pagina: cab.pagina } };
          Importar.inserirNoLugar(p, id, cab.numero);
        }
      });
    } else {
      aviso(`${cabs.length} cenas encontradas no roteiro e ligadas aos cartões.`);
    }
  }

  function htmlMargem(cab) {
    const id = cab.numero && cenaPorNumero(cab.numero);
    const c = id && cena(id);
    if (!c) return `<div class="mc falta" title="Esta cena não está no quadro"><b>CENA ${esc(cab.numero || "?")}</b><div class="fr"></div></div>`;
    return `<div class="mc" data-id="${id}"><b>${esc(titulo(c))}</b><div class="fr">${imgFrame(c)}</div></div>`;
  }

  function topo() {
    const pd = Q.sel && parteDe(Q.sel);
    const r = Q.p.roteiro;
    return `<div class="stb"><span>${pd ? esc(`${pd.parte.nome}${pd.parte.titulo ? " · " + pd.parte.titulo : ""}`.toUpperCase()) : ""}</span>
      <span style="margin-left:auto">${r ? `Roteiro importado de <b>${esc(r.nome || "roteiro.pdf")}</b>` : ""}</span>
      <span class="ro">SÓ LEITURA</span><button class="btn" id="btnPdf">IMPORTAR PDF</button></div>`;
  }

  function desenhar() {
    if (Q.vista !== "roteiro" || !Q.p) return;
    const v = $("#vRoteiro");
    const r = Q.p.roteiro;
    if (!r || !r.cenas) {
      montado = null;
      v.innerHTML = `${topo()}<div class="vazio-r"><b>ROTEIRO</b>Importe o roteiro em PDF (exportado do Final Draft, WriterDuet, Word…).<br>O Quadro acha as cenas e põe cada cartão na margem do roteiro.<br><small>PDF escaneado (imagem) não funciona.</small><br><button class="btn" id="btnPdf2">IMPORTAR PDF</button></div>`;
      return;
    }
    const chave = chaveAtual();
    if (montado === chave) {
      // já desenhado: só atualiza o topo e os cartões da margem
      v.querySelector(".stb").outerHTML = topo();
      for (const el of $$(".ln.sh[data-k]", v)) {
        const cab = r.cenas[+el.dataset.k];
        const novo = document.createElement("div");
        novo.innerHTML = htmlMargem(cab);
        el.querySelector(".mc").replaceWith(novo.firstChild);
      }
      marcarSelecao();
      return;
    }
    if (!doc || doc.chave !== chave) {
      v.innerHTML = `${topo()}<div class="vazio-r">${erro ? `<b>NÃO FOI POSSÍVEL LER O ROTEIRO</b>${esc(erro)}` : "<b>LENDO O ROTEIRO…</b>"}</div>`;
      if (!erro) carregar().then(desenhar, desenhar);
      return;
    }
    // qual cabeçalho começa em cada linha
    const cabPorLinha = new Map(r.cenas.map((c, k) => [c.linha, k]));
    let k = -1;
    const paginas = doc.paginas.map((pg, n) => `<div class="sheet" data-pag="${n + 1}">${pg.map((l) => {
      if (l.i !== undefined && cabPorLinha.has(l.i)) {
        k = cabPorLinha.get(l.i);
        return `<div class="ln sh" data-k="${k}" style="padding-left:${l.recuo}ch">${htmlMargem(r.cenas[k])}${esc(l.t.trim())}</div>`;
      }
      return `<div class="ln${k >= 0 ? " cl" : ""}" ${k >= 0 ? `data-k="${k}"` : ""} style="padding-left:${l.recuo}ch">${esc(l.t.trimStart())}</div>`;
    }).join("")}</div>`).join("");
    v.innerHTML = `${topo()}<div class="sheets">${paginas}</div>`;
    montado = chave;
    marcarSelecao(true);
  }

  /** Barra vermelha na cena selecionada e as outras apagadas. */
  function marcarSelecao(rolar = !semRolar) {
    semRolar = false;
    if (Q.vista !== "roteiro" || !montado || !Q.p.roteiro) return;
    const c = cena(Q.sel);
    const ks = c ? Q.p.roteiro.cenas.map((cab, k) => (cab.numero && normNum(cab.numero) === normNum(c.numero) ? k : -1)).filter((k) => k >= 0) : [];
    const sel = new Set(ks.map(String));
    const v = $("#vRoteiro");
    for (const el of $$(".ln[data-k]", v)) {
      const on = sel.has(el.dataset.k);
      el.classList.toggle("on", on);
      el.classList.toggle("dim", sel.size > 0 && !on);
    }
    const st = $(".stb", v);
    if (st) st.outerHTML = topo();
    if (rolar && ks.length) {
      const h = $(`.ln.sh[data-k="${ks[0]}"]`, v);
      if (h) h.scrollIntoView({ block: "start" });
      v.scrollTop -= 80;
    }
  }

  $("#vRoteiro").addEventListener("click", (ev) => {
    if (ev.target.closest("#btnPdf, #btnPdf2")) return importar();
    const ln = ev.target.closest("[data-k]");
    if (!ln || !Q.p.roteiro) return;
    const cab = Q.p.roteiro.cenas[+ln.dataset.k];
    const id = cab && cab.numero && cenaPorNumero(cab.numero);
    if (id) { semRolar = true; selecionar(id, { rolar: false }); }
  });

  registrar("roteiro", desenhar);
  registrar("roteiro-sel", () => marcarSelecao());
  return { importar, esquecer: () => { doc = null; montado = null; erro = null; } };
})();
