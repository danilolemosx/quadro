// Estado do app: o projeto aberto, a seleção, desfazer/refazer e o salvamento automático.
"use strict";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const STATUS = {
  montada: { nome: "Montada", botao: "MONTADA", cor: "#4f9a5b" },
  ajuste: { nome: "Em ajuste", botao: "EM AJUSTE", cor: "#e0a530" },
  falta: { nome: "Falta material", botao: "FALTA", cor: "#d2382f" },
};
const CORES_PARTE = ["#f28cb1", "#f5b98c", "#7cc4ea", "#b99be6", "#f3e36a", "#a6dc8a"];
const CORES_NOTA = ["#f6e35d", "#f28cb1", "#7cc4ea", "#a6dc8a"];
const MATERIAIS = [
  ["aco", "Aço"], ["cortica", "Cortiça"], ["feltro", "Feltro"], ["madeira", "Madeira"],
  ["lousa", "Lousa"], ["kraft", "Papel kraft"], ["liso", "Cinza liso"],
];

const Q = {
  caminho: null, // pasta Nome.quadro
  p: null, // projeto.json
  sel: null, // id da cena selecionada
  vista: "quadro",
  zoom: 1,
  fechadas: new Set(), // partes fechadas na estrutura
  desfazer: [],
  refazer: [],
  ultimaChave: null,
  ultimaHora: 0,
  salvoEm: null,
  erroSalvar: null,
  timerSalvar: null,
  salvando: null,
  seg: {}, // segundos de cada cena (cache, não vai para o arquivo)
  renders: [], // funções de desenho registradas pelas vistas
};

// ---------- consultas ----------
const cena = (id) => Q.p && Q.p.cenas[id];
function parteDe(id) {
  for (const parte of Q.p.partes) {
    const i = parte.cenas.indexOf(id);
    if (i >= 0) return { parte, i };
  }
  return null;
}
const ordem = () => Q.p.partes.flatMap((p) => p.cenas);
const normNum = (n) => String(n ?? "").trim().toUpperCase().replace(/^0+(?=\d)/, "");
function cenaPorNumero(numero) {
  const n = normNum(numero);
  return Object.keys(Q.p.cenas).find((id) => normNum(Q.p.cenas[id].numero) === n);
}
function novoId(prefixo) {
  let id;
  do id = prefixo + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
  while (Q.p && (Q.p.cenas[id] || Q.p.partes.some((p) => p.id === id)));
  return id;
}
/** Próximo número livre: o maior número inteiro do projeto + 1. */
function proximoNumero() {
  let max = 0;
  for (const c of Object.values(Q.p.cenas)) {
    const m = /^(\d+)/.exec(c.numero || "");
    if (m) max = Math.max(max, +m[1]);
  }
  return String(max + 1);
}
/** Número pseudoaleatório fixo para cada id (inclinação dos cartões, que não muda ao reabrir). */
function sorte(id, k = 0) {
  let h = 2166136261 ^ k;
  for (const ch of String(id)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) % 10000) / 10000;
}
function frameUrl(c, grande = false) {
  const rel = c && (grande ? c.frame : c.mini || c.frame);
  return rel ? Ponte.url(Ponte.junta(Q.caminho, rel)) : null;
}
const imgFrame = (c, grande) => {
  const u = frameUrl(c, grande);
  return u ? `<img src="${esc(u)}" loading="lazy" decoding="async" alt="">` : "";
};
const titulo = (c) => "CENA " + (c.numero || "?");
function temNotas(c) {
  return !!((c.notas && c.notas.trim()) || (c.postits && c.postits.length));
}
/** "00:01:42:00" → "1:42" (como nas telas). */
function duracaoCurta(tc) {
  const m = /^(\d+):(\d+):(\d+)[:;.](\d+)$/.exec(tc || "");
  if (!m) return tc || "";
  const [h, mi, s] = [+m[1], +m[2], +m[3]];
  return h ? `${h}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${mi}:${String(s).padStart(2, "0")}`;
}
/** Segundos → "1h52", "22:18" (lista) ou "18min" (rodapé). */
function tempoTotal(seg, estilo = "rodape") {
  seg = Math.round(seg);
  const h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
  if (estilo === "lista") return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  return h ? `${h}h${String(m).padStart(2, "0")}` : `${m}min`;
}
const segundosDe = (ids) => ids.reduce((t, id) => t + (Q.seg[id] || 0), 0);

// ---------- mudanças (com desfazer) ----------
/**
 * Toda mudança no projeto passa por aqui: guarda o estado anterior para desfazer, aplica, salva e redesenha.
 * `chave` junta mudanças seguidas no mesmo campo (digitar num campo vira um passo só de desfazer).
 * `sem` evita redesenhar uma parte da tela (ex.: a ficha enquanto se digita nela).
 */
function mudar(fn, { chave = null, sem = null } = {}) {
  const agora = Date.now();
  if (!(chave && chave === Q.ultimaChave && agora - Q.ultimaHora < 2500)) {
    Q.desfazer.push(JSON.stringify(Q.p));
    if (Q.desfazer.length > 300) Q.desfazer.shift();
  }
  Q.ultimaChave = chave;
  Q.ultimaHora = agora;
  Q.refazer.length = 0;
  fn(Q.p);
  agendarSalvar();
  desenhar(sem);
  atualizarSegundos();
}
function desfazer() {
  if (!Q.desfazer.length) return aviso("Nada para desfazer.");
  Q.refazer.push(JSON.stringify(Q.p));
  Q.p = JSON.parse(Q.desfazer.pop());
  Q.ultimaChave = null;
  depoisDeTrocar();
}
function refazer() {
  if (!Q.refazer.length) return;
  Q.desfazer.push(JSON.stringify(Q.p));
  Q.p = JSON.parse(Q.refazer.pop());
  Q.ultimaChave = null;
  depoisDeTrocar();
}
function depoisDeTrocar() {
  if (Q.sel && !cena(Q.sel)) Q.sel = ordem()[0] || null;
  agendarSalvar();
  desenhar();
  atualizarSegundos();
}

// ---------- salvar ----------
function agendarSalvar() {
  clearTimeout(Q.timerSalvar);
  Q.timerSalvar = setTimeout(salvarAgora, 600);
}
async function salvarAgora() {
  clearTimeout(Q.timerSalvar);
  if (!Q.p) return;
  const texto = JSON.stringify(Q.p);
  try {
    if (Q.salvando) await Q.salvando;
    Q.salvando = Ponte.salvar(Q.caminho, JSON.parse(texto));
    await Q.salvando;
    Q.salvoEm = Date.now();
    Q.erroSalvar = null;
  } catch (e) {
    Q.erroSalvar = String(e);
  } finally {
    Q.salvando = null;
    desenharSalvo();
  }
}
function desenharSalvo() {
  const el = $("#pSalvo");
  if (!el) return;
  if (Q.erroSalvar) {
    el.innerHTML = `<span class="erro" title="${esc(Q.erroSalvar)}">não foi possível salvar</span>`;
    return;
  }
  if (!Q.salvoEm) { el.textContent = ""; return; }
  const min = Math.floor((Date.now() - Q.salvoEm) / 60000);
  el.textContent = min < 1 ? "salvo agora" : min < 60 ? `salvo há ${min} min` : `salvo há ${Math.floor(min / 60)} h`;
}
setInterval(desenharSalvo, 20000);

// ---------- durações ----------
let timerSeg = null;
function atualizarSegundos() {
  clearTimeout(timerSeg);
  timerSeg = setTimeout(async () => {
    if (!Q.p) return;
    const ids = Object.keys(Q.p.cenas).filter((id) => Q.p.cenas[id].duracao);
    try {
      const s = await Ponte.segundos(ids.map((id) => Q.p.cenas[id].duracao), Q.p.fps || "23.976");
      Q.seg = {};
      ids.forEach((id, i) => (Q.seg[id] = s[i]));
    } catch { /* fps inválido: sem totais */ }
    desenharTotais();
  }, 60);
}
function desenharTotais() {
  for (const el of $$("[data-total-parte]")) {
    const parte = Q.p.partes.find((p) => p.id === el.dataset.totalParte);
    if (parte) el.textContent = `${parte.cenas.length} ${parte.cenas.length === 1 ? "cena" : "cenas"} · ${tempoTotal(segundosDe(parte.cenas), "lista")}`;
  }
  const t = $("#totalTempo");
  if (t) t.textContent = tempoTotal(segundosDe(ordem()));
}

// ---------- desenho ----------
/** Redesenha tudo (menos o que estiver em `sem`). */
function desenhar(sem = null) {
  if (!Q.p) return;
  for (const [nome, fn] of Q.renders) if (nome !== sem) fn();
  desenharTotais();
}
const registrar = (nome, fn) => Q.renders.push([nome, fn]);

/** Seleciona uma cena em todo o app. */
function selecionar(id, { rolar = true } = {}) {
  if (!id || !cena(id)) return;
  Q.sel = id;
  for (const el of $$(".card.sel, .lr.on, .op li.on")) el.classList.remove("sel", "on");
  for (const el of $$(`[data-id="${id}"]`)) el.classList.add(el.classList.contains("card") ? "sel" : "on");
  const pd = parteDe(id);
  if (pd && Q.fechadas.has(pd.parte.id)) { Q.fechadas.delete(pd.parte.id); }
  desenharSo("estrutura");
  desenharSo("ficha");
  desenharSo("roteiro-sel");
  if (rolar) {
    for (const el of $$(`[data-id="${id}"]`)) {
      if (el.offsetParent) el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }
}
function desenharSo(nome) {
  for (const [n, fn] of Q.renders) if (n === nome) fn();
}

// ---------- aviso rápido ----------
let timerAviso = null;
function aviso(texto, acao = null) {
  const el = $("#aviso");
  el.innerHTML = `<span>${esc(texto)}</span>` + (acao ? `<button>${esc(acao[0])}</button>` : "");
  el.classList.remove("oculto");
  if (acao) el.querySelector("button").onclick = () => { el.classList.add("oculto"); acao[1](); };
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.add("oculto"), acao ? 7000 : 3000);
}

// ---------- operações comuns ----------
/** Cria uma cena vazia na parte (no fim, ou depois da cena `depois`) e seleciona. */
function criarCena(parteId, { depois = null, numero = null, extra = {} } = {}) {
  const id = novoId("c");
  mudar((p) => {
    const parte = p.partes.find((x) => x.id === parteId) || p.partes[p.partes.length - 1];
    p.cenas[id] = { numero: numero || proximoNumero(), resumo: "", personagens: [], status: "", postits: [], ...extra };
    const i = depois ? parte.cenas.indexOf(depois) : -1;
    if (i >= 0) parte.cenas.splice(i + 1, 0, id);
    else parte.cenas.push(id);
  });
  selecionar(id);
  return id;
}
function criarParte() {
  const id = novoId("p");
  mudar((p) => {
    const n = p.partes.length + 1;
    p.partes.push({ id, nome: `Parte ${n}`, titulo: "", cor: CORES_PARTE[(n - 1) % CORES_PARTE.length], cenas: [] });
  });
  return id;
}
function apagarCena(id) {
  const c = cena(id);
  if (!c) return;
  const seq = ordem();
  const i = seq.indexOf(id);
  mudar((p) => {
    for (const parte of p.partes) parte.cenas = parte.cenas.filter((x) => x !== id);
    delete p.cenas[id];
  });
  Q.sel = seq[i + 1] || seq[i - 1] || null;
  desenhar();
  aviso(`${titulo(c)} apagada.`, ["DESFAZER", desfazer]);
}
/** Move a cena para a parte `parteId`, antes da cena `antes` (ou no fim). */
function moverCena(id, parteId, antes) {
  if (id === antes) return;
  mudar((p) => {
    for (const parte of p.partes) parte.cenas = parte.cenas.filter((x) => x !== id);
    const parte = p.partes.find((x) => x.id === parteId);
    const i = antes ? parte.cenas.indexOf(antes) : -1;
    if (i >= 0) parte.cenas.splice(i, 0, id);
    else parte.cenas.push(id);
  });
}
function moverParte(id, antes) {
  if (id === antes) return;
  mudar((p) => {
    const parte = p.partes.find((x) => x.id === id);
    p.partes = p.partes.filter((x) => x.id !== id);
    const i = antes ? p.partes.findIndex((x) => x.id === antes) : -1;
    if (i >= 0) p.partes.splice(i, 0, parte);
    else p.partes.push(parte);
  });
}
function moverNota(deCena, notaId, paraCena) {
  if (deCena === paraCena) return;
  mudar((p) => {
    const de = p.cenas[deCena], para = p.cenas[paraCena];
    const i = (de.postits || []).findIndex((n) => n.id === notaId);
    if (i < 0) return;
    const [n] = de.postits.splice(i, 1);
    (para.postits = para.postits || []).push(n);
  });
}
function novaNota(id) {
  const nid = novoId("n");
  mudar((p) => (p.cenas[id].postits = p.cenas[id].postits || []).push({ id: nid, texto: "", cor: CORES_NOTA[0] }));
  return nid;
}
