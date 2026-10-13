// Visão Lista: as mesmas cenas em tabela, agrupadas por parte (o post-it da parte é o cabeçalho).
"use strict";

function desenharLista() {
  if (Q.vista !== "lista") return;
  const hits = Busca.resultado();
  let k = 0;
  const grupos = Q.p.partes.map((parte) => `
    <div class="grp" data-parte="${parte.id}">
      <div class="lpw" data-parte="${parte.id}">
        <div class="lp" data-arr="parte" data-parte="${parte.id}" style="background:${esc(parte.cor)};--r:${(sorte(parte.id) * 2 - 1.6).toFixed(1)}deg"><span class="hd2">⋮⋮</span>${esc(parte.nome)}${parte.titulo ? ` ·<small>${esc(parte.titulo)}</small>` : ""}</div>
        <em data-total-parte="${parte.id}"></em>
      </div>
      ${parte.cenas.map((id) => {
        const c = cena(id), st = STATUS[c.status];
        const nota = (c.postits || [])[0];
        const cls = ["lr", k++ % 2 ? "par" : "", id === Q.sel ? "on" : "", hits ? (hits.has(id) ? "hit" : "apagado") : ""].join(" ");
        return `<div class="${cls}" data-arr="cena" data-id="${id}">
          <span class="hd2">⋮⋮</span>
          <div class="th"><div>${imgFrame(c)}</div></div>
          <span class="n">${esc(c.numero)}</span>
          <span class="rs">${esc(c.resumo || "")}</span>
          <span class="ch">${(c.personagens || []).map((p) => `<span>${esc(p)}</span>`).join("")}</span>
          ${st ? `<span class="pill" style="background:${st.cor}">${st.nome}</span>` : "<span></span>"}
          <span class="du">${esc(duracaoCurta(c.duracao))}</span>
          ${nota ? `<div class="nt" data-arr="nota" data-cena="${id}" data-nota="${nota.id}" style="background:${esc(nota.cor || CORES_NOTA[0])}" title="${esc((c.postits || []).map((n) => n.texto).join("\n"))}">${esc(nota.texto)}</div>` : ""}
        </div>`;
      }).join("") || `<div class="vazio-l">Nenhuma cena nesta parte. Arraste uma linha para cá.</div>`}
    </div>`).join("");
  $("#vLista").innerHTML = `<div class="lh"><span></span><span>FRAME</span><span>CENA</span><span>RESUMO</span><span>PERSONAGENS</span><span>STATUS</span><span style="text-align:right">DURAÇÃO</span></div>${grupos}`;
  desenharTotais();
}
registrar("lista", desenharLista);

$("#vLista").addEventListener("click", (ev) => {
  const lr = ev.target.closest(".lr");
  if (lr) selecionar(lr.dataset.id, { rolar: false });
});
$("#vLista").addEventListener("dblclick", (ev) => {
  const lp = ev.target.closest(".lp");
  if (lp) return editarParte(lp.dataset.parte, ev.clientX, ev.clientY);
  const lr = ev.target.closest(".lr");
  if (lr) { selecionar(lr.dataset.id, { rolar: false }); Ficha.focarResumo(); }
});
