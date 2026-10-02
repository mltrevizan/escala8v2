// src/feriados.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';

export function renderFeriadosModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let delCheckboxes = (appState.delegacias || []).map(d => `
    <label class="flex items-center gap-1.5 p-1.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium cursor-pointer hover:bg-slate-100">
      <input type="checkbox" name="feriado_delegacias_ids" value="${d.id}" class="rounded text-indigo-600 focus:ring-indigo-500">
      <span class="truncate">${d.nome}</span>
    </label>
  `).join('');

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div>
        <h2 class="font-bold text-sm text-slate-800">Módulo de Feriados</h2>
        <p class="text-[11px] text-slate-500">Gestão de feriados Nacionais, Estaduais e Municipais por abrangência de unidade</p>
      </div>

      <!-- Formulário de Cadastro -->
      <form onsubmit="window.salvarFeriado(event)" class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Data do Feriado:</label>
            <input type="date" id="feriado-data" required class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Descrição / Nome:</label>
            <input type="text" id="feriado-desc" required placeholder="Ex: Padroeiro da Cidade / Proclamação" class="w-full border border-slate-300 rounded-lg p-1.5 font-medium text-slate-800 bg-slate-50">
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Tipo de Feriado:</label>
            <select id="feriado-tipo" onchange="window.toggleSelecaoDelegaciasFeriado(this.value)" class="w-full border border-slate-300 rounded-lg p-1.5 font-bold text-slate-800 bg-slate-50">
              <option value="NACIONAL">Nacional (Todas as Unidades e CRF)</option>
              <option value="ESTADUAL">Estadual (Todas as Unidades e CRF)</option>
              <option value="MUNICIPAL">Municipal (Delegacias Específicas / Plantão Unificado)</option>
            </select>
          </div>

          <div class="flex items-end justify-end">
            <button type="submit" class="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition">
              ➕ Cadastrar Feriado
            </button>
          </div>
        </div>

        <!-- PAINEL DE DELEGACIAS AFETADAS (EXIBIDO SE MUNICIPAL) -->
        <div id="container-feriado-delegacias" class="hidden pt-2 border-t border-slate-200 space-y-1.5">
          <label class="block font-bold text-slate-800 text-xs">Selecione as Delegacias Afetadas por este Feriado Municipal:</label>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
            ${delCheckboxes}
          </div>
        </div>
      </form>
    </div>

    <!-- Tabela de Feriados Cadastrados -->
    <div class="overflow-x-auto font-sans">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Data</th>
            <th class="p-3">Descrição</th>
            <th class="p-3">Tipo</th>
            <th class="p-3">Abrangência / Delegacias Afetadas</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-feriados-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  renderTabelaFeriados();
}

window.toggleSelecaoDelegaciasFeriado = function(tipo) {
  const container = document.getElementById('container-feriado-delegacias');
  if (!container) return;

  if (tipo === 'MUNICIPAL') {
    container.classList.remove('hidden');
  } else {
    container.classList.add('hidden');
  }
};

function renderTabelaFeriados() {
  const tbody = document.getElementById('tabela-feriados-corpo');
  if (!tbody) return;

  const lista = (appState.feriados || []).sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">Nenhum feriado cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(f => {
    const isMunicipal = f.tipo === 'MUNICIPAL';
    let abrangenciaTexto = '<span class="text-emerald-700 font-bold">Geral (Todas as Unidades)</span>';

    if (isMunicipal) {
      const ids = f.delegaciasIds || [];
      if (ids.length === 0) {
        abrangenciaTexto = '<span class="text-amber-600 italic">Nenhuma delegacia vinculada</span>';
      } else {
        const nomes = ids.map(id => {
          const d = (appState.delegacias || []).find(del => del.id === id);
          return d ? d.nome : 'Unidade';
        });
        abrangenciaTexto = `<span class="text-indigo-900 font-medium">${nomes.join(', ')}</span>`;
      }
    }

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(f.data)}</td>
        <td class="p-3 font-semibold text-slate-800">${f.descricao || '-'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isMunicipal ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-indigo-100 text-indigo-900 border border-indigo-300'}">
            ${f.tipo || 'NACIONAL'}
          </span>
        </td>
        <td class="p-3">${abrangenciaTexto}</td>
        <td class="p-3 text-right">
          <button onclick="window.excluirFeriado('${f.id}')" class="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold text-[10px] shadow-xs cursor-pointer">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.salvarFeriado = async function(e) {
  e.preventDefault();

  const data = document.getElementById('feriado-data').value;
  const descricao = document.getElementById('feriado-desc').value;
  const tipo = document.getElementById('feriado-tipo').value;

  let delegaciasIds = [];
  if (tipo === 'MUNICIPAL') {
    const selecionados = document.querySelectorAll('input[name="feriado_delegacias_ids"]:checked');
    delegaciasIds = Array.from(selecionados).map(cb => cb.value);

    if (delegaciasIds.length === 0) {
      alert("Para feriados municipais, selecione pelo menos uma delegacia afetada.");
      return;
    }
  }

  const newFerId = 'feriado_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novoFeriado = {
    id: newFerId,
    data: data,
    descricao: descricao,
    tipo: tipo,
    delegaciasIds: delegaciasIds
  };

  if (!appState.feriados) appState.feriados = [];
  appState.feriados.push(novoFeriado);

  await syncDocToFirestore('feriados', newFerId, novoFeriado);

  alert("Feriado cadastrado com sucesso!");
  renderFeriadosModule('feriados-container');

  renderCalendarGrid('calendar-crf-container', 'CRF');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

window.excluirFeriado = async function(id) {
  if (!confirm("Deseja realmente remover este feriado?")) return;

  appState.feriados = (appState.feriados || []).filter(f => f.id !== id);
  await syncDocToFirestore('feriados', id, null, true);

  renderTabelaFeriados();
  renderCalendarGrid('calendar-crf-container', 'CRF');
  renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}
