// src/ferias.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderFeriasModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let srvOptions = `<option value="">Selecione o Servidor...</option>`;
  [...(appState.servidores || [])]
    .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
    .forEach(s => {
      srvOptions += `<option value="${s.id}">${s.nome} (${s.cargo || 'APJ'})</option>`;
    });

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Módulo de Férias e Licenças</h2>
          <p class="text-[11px] text-slate-500">Cadastro de afastamentos e monitoramento de conflitos de escala</p>
        </div>
      </div>

      <!-- Formulário de Cadastro -->
      <form onsubmit="window.salvarFerias(event)" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-xs text-xs">
        <div class="md:col-span-2">
          <label class="block font-bold text-slate-700 mb-1">Policial / Servidor:</label>
          <select id="ferias-servidor-id" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
            ${srvOptions}
          </select>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Tipo de Afastamento:</label>
          <select id="ferias-tipo" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
            <option value="Férias">Férias</option>
            <option value="Licença Prêmio">Licença Prêmio</option>
            <option value="Licença Médica">Licença Médica</option>
            <option value="Folga Compensatória">Folga Compensatória</option>
            <option value="Outros">Outros</option>
          </select>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Data Início:</label>
          <input type="date" id="ferias-data-inicio" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Data Fim:</label>
          <input type="date" id="ferias-data-fim" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
        </div>

        <div class="md:col-span-5 flex justify-end pt-1">
          <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition">
            ➕ Cadastrar Afastamento
          </button>
        </div>
      </form>
    </div>

    <!-- Tabela de Registros com Auditoria de Conflitos -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Servidor / Policial</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Afastamento</th>
            <th class="p-3">Período</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-ferias-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  renderTabelaFerias();
}

function renderTabelaFerias() {
  const tbody = document.getElementById('tabela-ferias-corpo');
  if (!tbody) return;

  const listaFerias = appState.ferias || [];

  if (listaFerias.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">Nenhum período de férias ou licença cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = listaFerias.map(fer => {
    const srv = (appState.servidores || []).find(s => s.id === fer.servidorId);
    
    // AUDITORIA: BUSCA SE HÁ PLANTÕES/SOBREAVISOS MARCADOS DURANTE ESTE AFASTAMENTO
    const escalasEmConflito = (appState.escalas || []).filter(e => {
      return e.servidorId === fer.servidorId && e.data >= fer.dataInicio && e.data <= fer.dataFim;
    });

    const temConflito = escalasEmConflito.length > 0;
    const idsConflitoStr = escalasEmConflito.map(e => e.id).join(',');

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-200 text-xs">
        <td class="p-3 font-bold text-slate-800">
          <div class="flex items-center gap-2">
            <span>${srv?.nome || 'Servidor Não Encontrado'}</span>
            ${temConflito ? `
              <button type="button" onclick="window.exibirDetalhesConflitoFerias('${srv?.nome}', '${idsConflitoStr}')" 
                      class="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-extrabold text-[10px] rounded-full shadow-xs cursor-pointer flex items-center gap-1 transition">
                <span>⚠️</span> ${escalasEmConflito.length} Plantão(ões) Marcado(s)
              </button>
            ` : ''}
          </div>
        </td>
        <td class="p-3 text-slate-600 font-medium">${srv?.cargo || 'APJ'}</td>
        <td class="p-3 font-bold text-indigo-900">${fer.tipo || 'Férias'}</td>
        <td class="p-3 font-mono text-slate-700">${formatarDataBr(fer.dataInicio)} à ${formatarDataBr(fer.dataFim)}</td>
        <td class="p-3 text-right">
          <button onclick="window.excluirFerias('${fer.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] shadow-xs cursor-pointer">Excluir</button>
        </td>
      </tr>
    `;
  }).join('');
}

window.salvarFerias = async function(e) {
  e.preventDefault();

  const servidorId = document.getElementById('ferias-servidor-id').value;
  const tipo = document.getElementById('ferias-tipo').value;
  const dataInicio = document.getElementById('ferias-data-inicio').value;
  const dataFim = document.getElementById('ferias-data-fim').value;

  if (dataFim < dataInicio) {
    alert("A data final não pode ser anterior à data inicial.");
    return;
  }

  const newFerId = 'fer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novoAfastamento = {
    id: newFerId,
    servidorId: servidorId,
    tipo: tipo,
    dataInicio: dataInicio,
    dataFim: dataFim
  };

  if (!appState.ferias) appState.ferias = [];
  appState.ferias.push(novoAfastamento);

  await syncDocToFirestore('ferias', newFerId, novoAfastamento);

  alert("Afastamento cadastrado com sucesso!");
  renderTabelaFerias();
};

window.excluirFerias = async function(id) {
  if (!confirm("Deseja realmente remover este registro de afastamento?")) return;

  appState.ferias = (appState.ferias || []).filter(f => f.id !== id);
  await syncDocToFirestore('ferias', id, null, true);

  renderTabelaFerias();
};

window.exibirDetalhesConflitoFerias = function(nomeServidor, idsEscalasStr) {
  const ids = idsEscalasStr.split(',').filter(Boolean);
  const escalas = (appState.escalas || []).filter(e => ids.includes(e.id));

  let detalheMsg = `⚠️ DATAS EM CONFLITO DE AFASTAMENTO\n\nPolicial: ${nomeServidor}\n\nEste servidor possui os seguintes lançamentos agendados durante seu afastamento:\n\n`;

  escalas.forEach(esc => {
    const del = (appState.delegacias || []).find(d => d.id === esc.delegaciaId);
    detalheMsg += `• Data: ${formatarDataBr(esc.data)} | Tipo: ${esc.tipo || 'PLANTÃO'} | Unidade: ${del ? del.nome : 'Unidade Local'}\n`;
  });

  alert(detalheMsg);
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}
