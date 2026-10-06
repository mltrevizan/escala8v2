// src/feriados.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';
import { renderCalendarGrid } from './calendar.js';
import { getPerfilUsuarioLogado, getDelegaciaIdUsuarioLogado, getSubdivisaoUsuarioLogado, PERFIS } from './permissions.js';

export function renderFeriadosModule(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const perfil = getPerfilUsuarioLogado();
  const userDelId = getDelegaciaIdUsuarioLogado();
  const sdpUser = getSubdivisaoUsuarioLogado();
  const anoAtual = new Date().getFullYear();

  // Filtra as delegacias que o usuário logado tem permissão para vincular a feriados municipais
  const delegaciasPermitidas = (appState.delegacias || []).filter(d => {
    if (perfil === PERFIS.ADMINISTRADOR) return true;
    if (perfil === PERFIS.COORDENADOR) {
      return d.subdivisao && d.subdivisao.trim().toUpperCase() === sdpUser;
    }
    if (perfil === PERFIS.DELEGADO || perfil === PERFIS.SUPERINTENDENTE) {
      return String(d.id) === String(userDelId);
    }
    return false;
  }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  let delCheckboxes = delegaciasPermitidas.map(d => `
    <label class="flex items-center gap-1.5 p-1.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-medium cursor-pointer hover:bg-slate-100">
      <input type="checkbox" name="feriado_delegacias_ids" value="${d.id}" class="rounded text-black focus:ring-pcpr-gold">
      <span class="truncate">${d.nome}</span>
    </label>
  `).join('');

  if (delegaciasPermitidas.length === 0) {
    delCheckboxes = `<span class="text-xs text-slate-400 italic p-2">Nenhuma delegacia disponível sob sua gestão.</span>`;
  }

  const html = `
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-4 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Módulo de Feriados Oficiais</h2>
          <p class="text-[11px] text-slate-500">Gestão de feriados Nacionais, Estaduais e Municipais por abrangência de unidade</p>
        </div>

        <div class="flex flex-wrap gap-2">
          <button type="button" onclick="window.carregarFeriadosNacionaisAnoAtual()" class="px-3 py-2 bg-[#2A2B2D] hover:bg-black text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
            ⚡ Importar Feriados Nacionais (${anoAtual})
          </button>
        </div>
      </div>

      <!-- Formulário de Cadastro / Edição -->
      <form onsubmit="window.salvarFeriado(event)" class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
        <input type="hidden" id="feriado-id-input" value="">

        <div class="flex items-center justify-between border-b-2 border-pcpr-gold pb-1.5">
          <h3 id="feriado-form-titulo" class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
            <span>🎉</span> Cadastrar Novo Feriado
          </h3>
          <button type="button" id="btn-cancelar-edicao-feriado" onclick="window.limparFormularioFeriado()" class="hidden text-[10px] font-bold text-red-600 hover:underline cursor-pointer">
            ✕ Cancelar Edição
          </button>
        </div>

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
            <button type="submit" id="btn-salvar-feriado" class="w-full sm:w-auto px-4 py-2 bg-black hover:bg-slate-800 text-pcpr-gold border border-pcpr-gold font-bold text-xs rounded-xl shadow-xs cursor-pointer transition flex items-center justify-center gap-1">
              ➕ Salvar Feriado
            </button>
          </div>
        </div>

        <!-- PAINEL DE DELEGACIAS AFETADAS (EXIBIDO SE MUNICIPAL) -->
        <div id="container-feriado-delegacias" class="hidden pt-2 border-t border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <label class="block font-bold text-slate-800 text-xs">Selecione as Delegacias Afetadas por este Feriado Municipal:</label>
            <button type="button" onclick="window.toggleTodasDelegaciasFeriado()" class="text-[10px] font-bold text-indigo-700 hover:underline cursor-pointer">
              ☑ Marcar / Desmarcar Todas
            </button>
          </div>
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
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider text-[10px]">
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

window.toggleTodasDelegaciasFeriado = function() {
  const checkboxes = document.querySelectorAll('input[name="feriado_delegacias_ids"]');
  if (checkboxes.length === 0) return;

  const algunDesmarcado = Array.from(checkboxes).some(cb => !cb.checked);
  checkboxes.forEach(cb => cb.checked = algunDesmarcado);
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
        abrangenciaTexto = `<span class="text-slate-900 font-medium">${nomes.join(', ')}</span>`;
      }
    }

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-200 text-xs">
        <td class="p-3 font-mono font-bold text-slate-800">${formatarDataBr(f.data)}</td>
        <td class="p-3 font-bold text-slate-900">${f.descricao || '-'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isMunicipal ? 'bg-[#F7F3E8] text-[#5A4716] border border-[#BEA55A]' : 'bg-black text-pcpr-gold border border-pcpr-gold'}">
            ${f.tipo || 'NACIONAL'}
          </span>
        </td>
        <td class="p-3">${abrangenciaTexto}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.editarFeriado('${f.id}')" class="px-2.5 py-1 bg-[#F7F3E8] text-[#5A4716] hover:bg-[#EFE8D3] border border-[#BEA55A] rounded font-bold text-[10px] shadow-xs cursor-pointer">
            ✏️ Editar
          </button>
          <button onclick="window.excluirFeriado('${f.id}')" class="px-2.5 py-1 bg-[#E2001A] hover:bg-red-700 text-white rounded font-bold text-[10px] shadow-xs cursor-pointer">
            🗑 Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.editarFeriado = function(id) {
  const feriado = (appState.feriados || []).find(f => f.id === id);
  if (!feriado) return;

  document.getElementById('feriado-id-input').value = feriado.id;
  document.getElementById('feriado-data').value = feriado.data || '';
  document.getElementById('feriado-desc').value = feriado.descricao || '';
  document.getElementById('feriado-tipo').value = feriado.tipo || 'NACIONAL';

  window.toggleSelecaoDelegaciasFeriado(feriado.tipo);

  const checkboxes = document.querySelectorAll('input[name="feriado_delegacias_ids"]');
  const idsVinculados = feriado.delegaciasIds || [];
  checkboxes.forEach(cb => {
    cb.checked = idsVinculados.includes(cb.value);
  });

  const tituloEl = document.getElementById('feriado-form-titulo');
  const btnCancelar = document.getElementById('btn-cancelar-edicao-feriado');
  const btnSalvar = document.getElementById('btn-salvar-feriado');

  if (tituloEl) tituloEl.innerHTML = '<span>✏️️</span> Editar Feriado Cadastrado';
  if (btnCancelar) btnCancelar.classList.remove('hidden');
  if (btnSalvar) btnSalvar.innerHTML = '💾 Atualizar Feriado';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.limparFormularioFeriado = function() {
  document.getElementById('feriado-id-input').value = '';
  document.getElementById('feriado-data').value = '';
  document.getElementById('feriado-desc').value = '';
  document.getElementById('feriado-tipo').value = 'NACIONAL';

  window.toggleSelecaoDelegaciasFeriado('NACIONAL');

  const checkboxes = document.querySelectorAll('input[name="feriado_delegacias_ids"]');
  checkboxes.forEach(cb => cb.checked = false);

  const tituloEl = document.getElementById('feriado-form-titulo');
  const btnCancelar = document.getElementById('btn-cancelar-edicao-feriado');
  const btnSalvar = document.getElementById('btn-salvar-feriado');

  if (tituloEl) tituloEl.innerHTML = '<span>🎉</span> Cadastrar Novo Feriado';
  if (btnCancelar) btnCancelar.classList.add('hidden');
  if (btnSalvar) btnSalvar.innerHTML = '➕ Salvar Feriado';
};

/**
 * Função de busca automatizada de feriados nacionais do ano corrente via API pública
 */
window.carregarFeriadosNacionaisAnoAtual = async function() {
  const anoAtual = new Date().getFullYear();

  if (!confirm(`Deseja importar automaticamente os feriados nacionais oficiais do ano de ${anoAtual}?`)) {
    return;
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${anoAtual}`);
    if (!res.ok) {
      throw new Error(`Erro de resposta da API (${res.status})`);
    }

    const feriadosApi = await res.json();
    if (!Array.isArray(feriadosApi) || feriadosApi.length === 0) {
      alert(`Nenhum feriado localizado para o ano de ${anoAtual}.`);
      return;
    }

    if (!appState.feriados) appState.feriados = [];

    let adicionados = 0;

    for (const item of feriadosApi) {
      // Evita duplicidade de feriados já cadastrados na mesma data
      const jaExiste = appState.feriados.some(f => f.data === item.date && f.tipo === 'NACIONAL');
      if (!jaExiste) {
        const ferId = 'feriado_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const novoObj = {
          id: ferId,
          data: item.date,
          descricao: item.name,
          tipo: 'NACIONAL',
          delegaciasIds: []
        };

        appState.feriados.push(novoObj);
        await syncDocToFirestore('feriados', ferId, novoObj);
        adicionados++;
      }
    }

    renderTabelaFeriados();
    if (window.renderCalendarGrid) {
      renderCalendarGrid('calendar-crf-container', 'CRF');
      renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
    }

    alert(`Importação concluída com sucesso!\n\n• Ano: ${anoAtual}\n• Novos Feriados Importados: ${adicionados}`);

  } catch (err) {
    console.error("Erro ao importar feriados:", err);
    alert(`Não foi possível carregar os feriados automaticamente (${err.message}). Verifique sua conexão.`);
  }
};

window.salvarFeriado = async function(e) {
  e.preventDefault();

  const idExistente = document.getElementById('feriado-id-input').value;
  const data = document.getElementById('feriado-data').value;
  const descricao = document.getElementById('feriado-desc').value.trim();
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

  const ferId = idExistente || 'feriado_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  const novoFeriado = {
    id: ferId,
    data: data,
    descricao: descricao,
    tipo: tipo,
    delegaciasIds: delegaciasIds
  };

  if (!appState.feriados) appState.feriados = [];

  const idx = appState.feriados.findIndex(f => f.id === ferId);
  if (idx >= 0) appState.feriados[idx] = novoFeriado;
  else appState.feriados.push(novoFeriado);

  window.limparFormularioFeriado();
  renderTabelaFeriados();

  if (window.renderCalendarGrid) {
    renderCalendarGrid('calendar-crf-container', 'CRF');
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }

  try {
    await syncDocToFirestore('feriados', ferId, novoFeriado);
    alert(idExistente ? "Feriado atualizado com sucesso!" : "Feriado cadastrado com sucesso!");
  } catch (err) {
    console.error("Erro ao salvar feriado no Firestore:", err);
  }
};

window.excluirFeriado = async function(id) {
  if (!confirm("Deseja realmente remover este feriado?")) return;

  appState.feriados = (appState.feriados || []).filter(f => f.id !== id);

  renderTabelaFeriados();

  if (window.renderCalendarGrid) {
    renderCalendarGrid('calendar-crf-container', 'CRF');
    renderCalendarGrid('calendar-delegacia-container', 'DELEGACIA');
  }

  try {
    await syncDocToFirestore('feriados', id, null, true);
  } catch (err) {
    console.error("Erro ao remover feriado no Firestore:", err);
  }
};

function formatarDataBr(dataIso) {
  if (!dataIso) return '-';
  const parts = dataIso.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dataIso;
}
