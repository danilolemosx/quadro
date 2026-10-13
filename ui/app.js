// Liga tudo: abrir/criar projeto, troca de visão, atalhos de teclado, menu do app e arquivos do Finder.
"use strict";

// ---------- vistas ----------
function trocarVista(v) {
  Q.vista = v;
  for (const b of $$("#vistas button")) b.classList.toggle("on", b.dataset.vista === v);
  $("#vQuadro").classList.toggle("oculto", v !== "quadro");
  $("#vLista").classList.toggle("oculto", v !== "lista");
  $("#vRoteiro").classList.toggle("oculto", v !== "roteiro");
  desenhar();
  atualizarBusca();
  guardarPreferencias();
  if (Q.sel) setTimeout(() => selecionar(Q.sel), 0);
}
$("#vistas").addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-vista]");
  if (b && Q.p) trocarVista(b.dataset.vista);
});

// ---------- topo ----------
function desenharTopo() {
  $("#pNome").textContent = Q.p.nome || "";
  $("#pCorte").textContent = Q.p.corte || "";
  desenharSalvo();
  Ponte.titulo(`Quadro — ${Q.p.nome || ""}`);
}
registrar("topo", desenharTopo);
$(".proj").addEventListener("dblclick", (ev) => {
  if (!Q.p) return;
  Ctx.abrir(ev.clientX, ev.clientY + 10, [{
    html: `<label>PROJETO<input data-c="nome" value="${esc(Q.p.nome || "")}"></label><label>CORTE<input data-c="corte" value="${esc(Q.p.corte || "")}" placeholder="ex.: corte 3"></label>`,
    depois(d) {
      for (const inp of $$("input", d)) {
        inp.addEventListener("input", () => mudar((p) => (p[inp.dataset.c] = inp.value), { chave: "projeto-" + inp.dataset.c }));
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") Ctx.fechar(); });
      }
      setTimeout(() => $("input", d).select(), 0);
    },
  }, "-", { t: "Mostrar no Finder", f: () => Ponte.mostrarNoFinder(Ponte.junta(Q.caminho, "projeto.json")) }]);
});

$("#btnCena").addEventListener("click", () => {
  if (!Q.p) return;
  const pd = Q.sel && parteDe(Q.sel);
  criarCena(pd ? pd.parte.id : Q.p.partes[Q.p.partes.length - 1].id, { depois: pd ? Q.sel : null });
  Ficha.focarResumo();
});

// ---------- abrir / criar ----------
function prepararProjeto(p) {
  p.cenas = p.cenas || {};
  p.partes = Array.isArray(p.partes) && p.partes.length ? p.partes : [{ id: "p1", nome: "Parte 1", titulo: "", cor: CORES_PARTE[0], cenas: [] }];
  p.opcoes = p.opcoes || { sombra: true, grade: false };
  for (const parte of p.partes) parte.cenas = (parte.cenas || []).filter((id) => p.cenas[id]);
  // cenas que não estão em nenhuma parte vão para a última
  const usadas = new Set(p.partes.flatMap((x) => x.cenas));
  for (const id of Object.keys(p.cenas)) if (!usadas.has(id)) p.partes[p.partes.length - 1].cenas.push(id);
  return p;
}
async function carregarProjeto({ caminho, projeto }) {
  if (Q.p) await salvarAgora();
  Q.caminho = caminho;
  Q.p = prepararProjeto(projeto);
  Q.sel = null;
  Q.desfazer = [];
  Q.refazer = [];
  Q.salvoEm = Date.now();
  Q.erroSalvar = null;
  Q.seg = {};
  lerPreferencias();
  if (!Q.sel) Q.sel = ordem()[0] || null;
  Roteiro.esquecer();
  Busca.texto = ""; Busca.status.clear(); Busca.pers.clear(); Busca.notas = Busca.semFrame = false; Busca.parte = null;
  $("#buscaTexto").value = "";
  Importar.fechar();
  document.body.classList.remove("sem-projeto");
  $("#zoom").value = Q.zoom;
  trocarVista(Q.vista);
  atualizarSegundos();
}
async function abrirProjeto(caminho) {
  try {
    carregarProjeto(await Ponte.abrirProjeto(caminho));
  } catch (e) {
    Ponte.avisar(`Não foi possível abrir o projeto.\n\n${e}`);
  }
}
async function escolherEAbrir() {
  const pasta = await Ponte.escolherPasta("Abrir projeto do Quadro (pasta .quadro)");
  if (pasta) abrirProjeto(pasta);
}

async function desenharInicio() {
  const rec = await Ponte.recentes().catch(() => []);
  $("#inicio").innerHTML = `<div class="ini">
    <div class="logo">QUADR<span>O</span></div>
    <p>O quadro de cenas do seu filme: um cartão por cena, com frame, número e resumo, organizado em partes.</p>
    <div class="novo"><input id="iNome" placeholder="Nome do projeto (ex.: Meu Filme)" spellcheck="false"><button class="btn2 go" id="iCriar">CRIAR PROJETO…</button></div>
    <div class="bts"><button class="btn2" id="iAbrir">ABRIR PROJETO…</button>${Q.p ? `<button class="btn2" id="iVoltar">VOLTAR PARA ${esc((Q.p.nome || "").toUpperCase())}</button>` : ""}</div>
    ${rec.length ? `<h4>RECENTES</h4><ul>${rec.map((c) => `<li><button data-rec="${esc(c)}"><b>${esc(Ponte.nome(c).replace(/\.quadro$/i, ""))}</b><small>${esc(c)}</small></button></li>`).join("")}</ul>` : ""}
  </div>`;
}
$("#inicio").addEventListener("click", async (ev) => {
  const t = ev.target.closest("button");
  if (!t) return;
  if (t.id === "iAbrir") return escolherEAbrir();
  if (t.id === "iVoltar") return document.body.classList.remove("sem-projeto");
  if (t.dataset.rec) return abrirProjeto(t.dataset.rec);
  if (t.id === "iCriar") {
    const nome = $("#iNome").value.trim();
    if (!nome) { $("#iNome").focus(); return aviso("Dê um nome ao projeto."); }
    const pasta = await Ponte.escolherPasta(`Onde guardar "${nome}"?`);
    if (!pasta) return;
    try { carregarProjeto(await Ponte.novoProjeto(pasta, nome)); }
    catch (e) { Ponte.avisar(String(e)); }
  }
});
$("#inicio").addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.id === "iNome") $("#iCriar").click(); });
function mostrarInicio() {
  desenharInicio().then(() => {
    document.body.classList.add("sem-projeto");
    $("#iNome") && $("#iNome").focus();
  });
}

// ---------- ações (menu e atalhos) ----------
const ultimaAcao = {};
function acao(nome) {
  // o mesmo atalho pode chegar pelo menu e pelo teclado: executa uma vez só
  const agora = Date.now();
  if (agora - (ultimaAcao[nome] || 0) < 150) return;
  ultimaAcao[nome] = agora;
  if (nome.startsWith("recente:")) return abrirProjeto(nome.slice(8));
  if (nome === "novo") return mostrarInicio();
  if (nome === "abrir") return escolherEAbrir();
  if (!Q.p) return;
  switch (nome) {
    case "salvar": salvarAgora().then(() => aviso("Projeto salvo.")); break;
    case "desfazer": desfazer(); break;
    case "refazer": refazer(); break;
    case "importar": Importar.abrir(); break;
    case "roteiro": Roteiro.importar(); break;
    case "finder": Ponte.mostrarNoFinder(Ponte.junta(Q.caminho, "projeto.json")); break;
    case "buscar": $("#buscaTexto").focus(); $("#buscaTexto").select(); break;
    default:
      if (nome.startsWith("vista:")) trocarVista(nome.slice(6));
  }
}
const emTexto = (el) => !!(el && el.closest && el.closest("input, textarea, select, [contenteditable='true']"));
Ponte.aoMenu((id) => {
  if ((id === "desfazer" || id === "refazer") && emTexto(document.activeElement)) {
    document.execCommand(id === "desfazer" ? "undo" : "redo");
    return;
  }
  acao(id);
});

/** Cena vizinha na tela (para as setas para cima e para baixo no quadro). */
function vizinhaVertical(id, dir) {
  const el = $(`#vQuadro .card[data-id="${id}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  let melhor = null, dist = Infinity;
  for (const c of $$("#vQuadro .card[data-id]")) {
    const q = c.getBoundingClientRect();
    const dy = (q.top - r.top) * dir;
    if (dy < r.height / 2) continue;
    const d = dy * 2 + Math.abs(q.left + q.width / 2 - cx);
    if (d < dist) { dist = d; melhor = c.dataset.id; }
  }
  return melhor;
}

document.addEventListener("keydown", (ev) => {
  const mod = ev.metaKey || ev.ctrlKey;
  const texto = emTexto(ev.target);
  if (mod && !ev.altKey) {
    const k = ev.key.toLowerCase();
    const mapa = { s: "salvar", f: "buscar", 1: "vista:quadro", 2: "vista:lista", 3: "vista:roteiro", o: "abrir", n: "novo", i: "importar" };
    if (k === "z" && !texto) { ev.preventDefault(); acao(ev.shiftKey ? "refazer" : "desfazer"); }
    else if (k === "y" && !texto) { ev.preventDefault(); acao("refazer"); }
    else if (mapa[k]) { ev.preventDefault(); acao(mapa[k]); }
    return;
  }
  if (ev.key === "Escape") {
    if (Ctx.aberto()) return Ctx.fechar();
    if (Importar.aberta()) return Importar.fechar();
    if (!$("#popMaterial").classList.contains("oculto")) return $("#popMaterial").classList.add("oculto");
    if (!texto && Busca.ativa()) { Busca.limpar(); return; }
  }
  if (texto || !Q.p || ev.altKey) return;
  const seq = ordem();
  const i = seq.indexOf(Q.sel);
  let nova = null;
  switch (ev.key) {
    case "ArrowRight": nova = seq[Math.min(seq.length - 1, i + 1)]; break;
    case "ArrowLeft": nova = seq[Math.max(0, i - 1)]; break;
    case "ArrowDown": nova = Q.vista === "quadro" ? vizinhaVertical(Q.sel, 1) : seq[Math.min(seq.length - 1, i + 1)]; break;
    case "ArrowUp": nova = Q.vista === "quadro" ? vizinhaVertical(Q.sel, -1) : seq[Math.max(0, i - 1)]; break;
    case "Enter": ev.preventDefault(); Ficha.focarResumo(); return;
    case "Delete": case "Backspace": ev.preventDefault(); if (Q.sel) apagarCena(Q.sel); return;
    default: return;
  }
  ev.preventDefault();
  if (!Q.sel) nova = seq[0];
  if (nova) selecionar(nova);
});

// ---------- arquivos do Finder ----------
let arrastados = [];
Ponte.aoArrastarArquivos((tipo, caminhos, x, y) => {
  if (caminhos.length) arrastados = caminhos;
  Importar.soltarArquivos(tipo, tipo === "drop" ? (caminhos.length ? caminhos : arrastados) : arrastados, x, y);
});

// ---------- fechar ----------
Ponte.aoFechar(async () => { await salvarAgora(); });
addEventListener("beforeunload", () => { if (Q.p) salvarAgora(); });

// ---------- começar ----------
(async () => {
  await desenharInicio();
  const inicial = await Ponte.projetoInicial().catch(() => null);
  if (inicial) return abrirProjeto(inicial);
  const rec = await Ponte.recentes().catch(() => []);
  if (rec[0]) abrirProjeto(rec[0]); // reabre o último projeto
  else $("#iNome") && $("#iNome").focus();
})();
