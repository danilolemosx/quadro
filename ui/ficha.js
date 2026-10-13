// Ficha da cena (direita, papel creme): tudo editável direto ali.
"use strict";

const FPS = ["23.976", "24", "25", "29.97", "29.97 DF", "30", "50", "59.94", "60"];

/** Completa o que foi digitado: "41:12" → 00:41:12:00, "1:42" na duração → 00:01:42:00, "00411200" → 00:41:12:00. */
function normalizarTc(texto) {
  let t = String(texto || "").trim();
  if (!t) return "";
  const drop = t.includes(";");
  if (/^\d+$/.test(t)) {
    t = t.padStart(8, "0").slice(-8);
    t = t.match(/../g).join(":");
  }
  const partes = t.split(/[:;.,]/).map((x) => x.trim()).filter((x) => x !== "");
  if (!partes.length || partes.length > 4 || partes.some((x) => !/^\d+$/.test(x))) return null;
  while (partes.length < 3) partes.unshift("0");
  if (partes.length === 3) partes.push("0");
  const [h, m, s, q] = partes.map((x) => x.padStart(2, "0"));
  return `${h}:${m}:${s}${drop ? ";" : ":"}${q}`;
}
const tcSemQuadros = (tc) => (tc ? tc.slice(0, 8) : "");

function desenharFicha() {
  const el = $("#ficha");
  // depois de redesenhar, o foco volta para o campo em que estava (ex.: Tab da entrada para a saída)
  const ativo = document.activeElement;
  const foco = ativo && el.contains(ativo) ? (ativo.dataset.tc ? `[data-tc="${ativo.dataset.tc}"]` : ativo.id ? `#${ativo.id}` : null) : null;
  const c = cena(Q.sel);
  if (!c) {
    el.innerHTML = `<div class="nada"><b>NENHUMA CENA</b>Clique num cartão para ver a ficha,<br>ou crie uma cena com <b style="display:inline;font-size:13px">+ CENA</b>.</div>`;
    return;
  }
  const id = Q.sel;
  const pd = parteDe(id);
  const st = c.status;
  el.innerHTML = `
    <div class="big">
      <div class="hd"><b>CENA <span contenteditable="true" spellcheck="false" id="fNumero">${esc(c.numero)}</span></b>
        <small>${pd ? `${esc(pd.parte.nome)} · ${pd.i + 1}/${pd.parte.cenas.length}` : ""}</small></div>
      <div class="fr" id="fFrame" title="Clique para trocar o frame (ou solte uma imagem aqui)">${imgFrame(c, true) || `<div class="semf">SOLTE UM FRAME AQUI<br>ou clique para escolher</div>`}</div>
    </div>
    <div class="lbl">Resumo</div>
    <textarea class="val" id="fResumo" rows="1" placeholder="O que acontece nesta cena?">${esc(c.resumo || "")}</textarea>
    <div class="lbl">Personagens</div>
    <div class="chips" id="fPersonagens">${(c.personagens || []).map((p, i) => `<span>${esc(p)}<button data-tirar="${i}" title="Tirar">×</button></span>`).join("")}<button class="mais" id="fMaisPers" title="Adicionar personagem">+</button></div>
    <div class="lbl">Status</div>
    <div class="stat">${Object.entries(STATUS).map(([k, s]) => `<button data-st="${k}" class="${k} ${st === k ? "on" : ""}">${s.botao}</button>`).join("")}</div>
    <div class="lbl" style="display:flex;justify-content:space-between">No Avid
      <select id="fFps" title="Taxa de quadros do projeto" style="font:inherit;font-size:9.5px;letter-spacing:.06em;color:#7d7466;background:none;border:0;cursor:pointer">${FPS.map((f) => `<option ${f === (Q.p.fps || "23.976") ? "selected" : ""}>${f}</option>`).join("")}</select></div>
    <div class="tc">
      <label><small>ENTRADA</small><input data-tc="entrada" placeholder="00:00:00" spellcheck="false"></label>
      <label><small>SAÍDA</small><input data-tc="saida" placeholder="00:00:00" spellcheck="false"></label>
      <label><small>DURAÇÃO</small><input data-tc="duracao" placeholder="0:00" spellcheck="false"></label>
    </div>
    <div class="lbl">Notas</div>
    <textarea class="notes" id="fNotas" rows="2" placeholder="Anotações da cena…">${esc(c.notas || "")}</textarea>
    <div class="acoes">
      <button id="fPostit">+ post-it no cartão</button>
      <button id="fTrocar">trocar frame</button>
      <button id="fApagar" class="perigo">apagar cena</button>
    </div>`;

  // tamanho automático dos textos
  const ajustar = (t) => { t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; };
  for (const t of $$("textarea", el)) { ajustar(t); t.addEventListener("input", () => ajustar(t)); }

  // número
  const num = $("#fNumero");
  num.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === "Escape") { ev.preventDefault(); if (ev.key === "Escape") num.textContent = c.numero; num.blur(); } });
  num.addEventListener("blur", () => {
    const novo = num.textContent.trim().toUpperCase();
    if (!novo || novo === c.numero) { num.textContent = c.numero; return; }
    const outra = cenaPorNumero(novo);
    mudar((p) => (p.cenas[id].numero = novo));
    if (outra && outra !== id) aviso(`Atenção: já existe outra cena ${novo}.`);
  });

  // textos
  $("#fResumo").addEventListener("input", (ev) => mudar((p) => (p.cenas[id].resumo = ev.target.value), { chave: id + "-resumo", sem: "ficha" }));
  $("#fNotas").addEventListener("input", (ev) => mudar((p) => (p.cenas[id].notas = ev.target.value), { chave: id + "-notas", sem: "ficha" }));
  for (const t of [$("#fResumo"), $("#fNotas")]) t.addEventListener("keydown", (ev) => { if (ev.key === "Escape") t.blur(); });

  // personagens
  $("#fPersonagens").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-tirar]");
    if (b) mudar((p) => p.cenas[id].personagens.splice(+b.dataset.tirar, 1));
  });
  $("#fMaisPers").addEventListener("click", () => {
    const todos = [...new Set(Object.values(Q.p.cenas).flatMap((x) => x.personagens || []))].sort((a, b) => a.localeCompare(b, "pt"));
    const inp = document.createElement("input");
    inp.placeholder = "Nome";
    inp.setAttribute("list", "listaPers");
    const dl = document.createElement("datalist");
    dl.id = "listaPers";
    dl.innerHTML = todos.map((n) => `<option value="${esc(n)}">`).join("");
    $("#fMaisPers").replaceWith(inp, dl);
    inp.focus();
    let feito = false;
    const confirmar = () => {
      if (feito) return;
      feito = true;
      const nomes = inp.value.split(",").map((s) => s.trim()).filter(Boolean);
      const atuais = c.personagens || [];
      const novos = nomes.filter((n) => !atuais.some((a) => a.toLowerCase() === n.toLowerCase()));
      if (novos.length) mudar((p) => (p.cenas[id].personagens = [...(p.cenas[id].personagens || []), ...novos]));
      else desenharFicha();
    };
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") { ev.preventDefault(); confirmar(); if (inp.value) setTimeout(() => $("#fMaisPers")?.click(), 0); }
      if (ev.key === "Escape") { feito = true; desenharFicha(); }
    });
    inp.addEventListener("blur", confirmar);
  });

  // status
  for (const b of $$("[data-st]", el)) b.addEventListener("click", () => mudar((p) => (p.cenas[id].status = p.cenas[id].status === b.dataset.st ? "" : b.dataset.st)));

  // timecodes
  $("#fFps").addEventListener("change", (ev) => mudar((p) => (p.fps = ev.target.value)));
  for (const inp of $$("[data-tc]", el)) {
    const campo = inp.dataset.tc;
    const curto = () => (campo === "duracao" ? duracaoCurta(c[campo]) : tcSemQuadros(c[campo]));
    inp.value = curto();
    inp.addEventListener("focus", () => { inp.value = c[campo] || ""; inp.select(); });
    inp.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") inp.blur();
      if (ev.key === "Escape") { inp.value = c[campo] || ""; inp.blur(); }
    });
    inp.addEventListener("blur", async () => {
      const v = normalizarTc(inp.value);
      if (v === null) { inp.classList.add("invalido"); aviso("Timecode inválido. Use HH:MM:SS:QQ."); return; }
      inp.classList.remove("invalido");
      if (v === (c[campo] || "")) { inp.value = curto(); return; }
      const novo = { ...c, [campo]: v };
      if (campo !== "duracao" && novo.entrada && novo.saida) {
        try { novo.duracao = await Ponte.duracao(novo.entrada, novo.saida, Q.p.fps || "23.976"); }
        catch (e) { aviso(String(e)); }
      }
      mudar((p) => { Object.assign(p.cenas[id], { entrada: novo.entrada || "", saida: novo.saida || "", duracao: novo.duracao || "" }); });
    });
  }

  // ações
  $("#fFrame").addEventListener("click", () => Importar.trocarFrame(id));
  $("#fTrocar").addEventListener("click", () => Importar.trocarFrame(id));
  $("#fPostit").addEventListener("click", () => editarNota(id, novaNota(id)));
  $("#fApagar").addEventListener("click", () => apagarCena(id));
  if (foco && $(foco, el)) $(foco, el).focus();
}
registrar("ficha", desenharFicha);

const Ficha = {
  focarResumo() {
    const t = $("#fResumo");
    if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  },
};
