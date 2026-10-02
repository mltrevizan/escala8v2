// Adicionar ao final do src/modals.js

window.abrirModalDetalhesTurno = function(titulo, horarioOuData, idsString) {
  let modal = document.getElementById('modal-detalhes-turno');
  if (!modal) {
    criarModalDetalhesTurnoDOM();
    modal = document.getElementById('modal-detalhes-turno');
  }

  const ids = (idsString || '').split(',').filter(Boolean);
  const escalas = (appState.escalas || []).filter(e => ids.includes(e.id));

  const containerCorpo = document.getElementById('modal-detalhes-corpo');
  const tituloEl = document.getElementById('modal-detalhes-titulo');

  if (tituloEl) {
    tituloEl.innerText = `${titulo} - Detalhes do Plantão`;
  }

  if (escalas.length === 0) {
    containerCorpo.innerHTML = `<p class="text-xs text-slate-500 italic p-4 text-center">Nenhum detalhe localizado para este lançamento.</p>`;
  } else {
    containerCorpo.innerHTML = escalas.map(esc => {
      const srv = (appState.servidores || []).find(s => s.id === esc.servidorId);
      const delEscala = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
      const delServidor = (appState.delegacias || []).find(d => d.id === srv?.delegaciaId);

      const lotacaoOrigem = delServidor ? delServidor.nome : (srv?.delegaciaNome || 'Lotação não informada');
      const unidadePlantao = delEscala ? delEscala.nome : 'Unidade Local';

      const isSobreaviso = esc.tipo === 'SOBREAVISO';
      const isExtra = esc.tipo === 'EXTRAJORNADA' || esc.tipo === 'SDP';

      let badgeClass = 'bg-sky-100 text-sky-900 border-sky-300';
      if (isSobreaviso) badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
      if (isExtra) badgeClass = 'bg-purple-100 text-purple-900 border-purple-300';

      return `
        <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div class="flex items-center justify-between border-b border-slate-200 pb-2">
            <div>
              <span class="font-black text-slate-900 text-sm block">${srv?.nome || 'Servidor Não Localizado'}</span>
              <span class="text-[11px] text-slate-500 font-medium">${srv?.cargo || 'APJ'} • Tel: ${srv?.telefone || 'Não informado'}</span>
            </div>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
              ${esc.tipo || 'PLANTÃO'}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700">
            <div><b>Lotação de Origem:</b> ${lotacaoOrigem}</div>
            <div><b>Unidade do Plantão:</b> ${unidadePlantao}</div>
            <div><b>Data do Lançamento:</b> ${formatarDataBr(esc.data)}</div>
            <div><b>Duração / Turno:</b> ${esc.turno || '24h'}</div>
          </div>

          <div class="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button onclick="window.fecharModalDetalhes(); window.abrirModalEscala(null, '${esc.id}', '${esc.scope}')" class="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px]">
              ✏️ Editar
            </button>
            <button onclick="window.excluirEscalaDoModal('${esc.id}', '${esc.scope}')" class="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[11px]">
              🗑️ Excluir
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
};

window.fecharModalDetalhes = function() {
  document.getElementById('modal-detalhes-turno')?.classList.add('hidden');
};

window.excluirEscalaDoModal = async function(escalaId, scope) {
  if (!confirm("Deseja realmente excluir este plantão?")) return;

  appState.escalas = appState.escalas.filter(e => e.id !== escalaId);
  await syncDocToFirestore('escalas', escalaId, null, true);

  window.fecharModalDetalhes();

  if (scope === 'CRF') {
    if (typeof window.filtrarTabelaCrfInline === 'function') window.filtrarTabelaCrfInline();
    renderCalendarGrid('calendar-crf-container', 'CRF');
  } else {
    if (typeof window.filtrarTabelaDelInline === 'function') window.filtrarTabelaDelInline();
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}

function criarModalDetalhesTurnoDOM() {
  const modalHTML = `
    <div id="modal-detalhes-turno" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-4 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b pb-3 shrink-0">
          <h3 id="modal-detalhes-titulo" class="font-bold text-slate-900 text-sm">Detalhes do Plantão</h3>
          <button type="button" onclick="window.fecharModalDetalhes()" class="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
        </div>

        <div id="modal-detalhes-corpo" class="space-y-3 flex-1 overflow-y-auto pr-1"></div>

        <div class="pt-2 border-t flex justify-end shrink-0">
          <button type="button" onclick="window.fecharModalDetalhes()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100 text-xs">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
