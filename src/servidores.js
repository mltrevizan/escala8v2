// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const subdivisoesUnicas = [...new Set(
    (appState.servidores || [])
      .map(s => s.subdivisao)
      .filter(Boolean)
  )].sort();

  let delegaciasOptions = `<option value="TODAS">Todas as Delegacias / Unidades</option>`;
  (appState.delegacias || []).forEach(d => {
    delegaciasOptions += `<option value="${d.id}">${d.nome}</option>`;
  });

  let subdivisaoOptions = `<option value="TODAS">Todas as Subdivisões</option>`;
  subdivisoesUnicas.forEach(sub => {
    subdivisaoOptions += `<option value="${sub}">${sub}</option>`;
  });

  let html = `
    <!-- Barra Superior com Controles e Filtros de Busca -->
    <div class="p-4 bg-slate-50 border-b border-slate-200 space-y-3 font-sans">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="font-bold text-sm text-slate-800">Cadastro Geral de Servidores</h2>
          <p class="text-[11px] text-slate-500">Gerencie e filtre policiais lotados no sistema da 8ª CRF</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="window.abrirModalServidor()" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1">
            ➕ Novo Policial
          </button>
          <label class="cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition shadow-xs flex items-center gap-1">
            <span>🔄 Corrigir Lotações via CSV</span>
            <input type="file" id="csv-file-input-servidores" accept=".csv" class="hidden" onchange="window.processarAtualizacaoCSV(event)">
          </label>
          <button onclick="window.excluirTodosServidores()" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition">
            🗑️ Excluir Todos
          </button>
        </div>
      </div>

      <!-- Filtros Dinâmicos -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔍 Busca Rápida (Nome, Cargo, Tel):</label>
          <input type="text" id="filtro-servidor-busca" oninput="window.filtrarServidoresInline()" placeholder="Digite para filtrar..." class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🏢 Filtrar por Unidade / Lotação:</label>
          <select id="filtro-servidor-delegacia" onchange="window.filtrarServidoresInline()" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold text-slate-800">
            ${delegaciasOptions}
          </select>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">🔰 Filtrar por Subdivisão / Regional:</label>
          <select id="filtro-servidor-subdivisao" onchange="window.filtrarServidoresInline()" class="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white font-bold text-slate-800">
            ${subdivisaoOptions}
          </select>
        </div>
      </div>

      <div id="servidor-count-summary" class="flex items-center justify-end text-[11px] text-slate-500 font-medium">
        Exibindo <b class="text-slate-800 mx-1">0</b> servidores cadastrados.
      </div>
    </div>

    <!-- Tabela de Servidores -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse font-sans">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold uppercase tracking-wider">
            <th class="p-3">Nome do Servidor</th>
            <th class="p-3">Cargo</th>
            <th class="p-3">Lotação / Delegacia</th>
            <th class="p-3">Subdivisão</th>
            <th class="p-3">Telefone / Prontidão</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody id="tabela-servidores-corpo" class="divide-y divide-slate-200"></tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
  window.filtrarServidoresInline();
}

window.filtrarServidoresInline = function() {
  const tbody = document.getElementById('tabela-servidores-corpo');
  if (!tbody) return;

  const busca = document.getElementById('filtro-servidor-busca')?.value?.toLowerCase() || '';
  const delFiltro = document.getElementById('filtro-servidor-delegacia')?.value || 'TODAS';
  const subFiltro = document.getElementById('filtro-servidor-subdivisao')?.value || 'TODAS';

  const servidoresFiltrados = (appState.servidores || []).filter(srv => {
    if (busca) {
      const nomeNorm = (srv.nome || '').toLowerCase();
      const cargoNorm = (srv.cargo || '').toLowerCase();
      const telNorm = (srv.telefone || '').toLowerCase();
      if (!nomeNorm.includes(busca) && !cargoNorm.includes(busca) && !telNorm.includes(busca)) {
        return false;
      }
    }

    if (delFiltro !== 'TODAS' && srv.delegaciaId !== delFiltro) {
      return false;
    }

    if (subFiltro !== 'TODAS' && srv.subdivisao !== subFiltro) {
      return false;
    }

    return true;
  });

  servidoresFiltrados.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

  const countEl = document.getElementById('servidor-count-summary');
  if (countEl) {
    countEl.innerHTML = `Exibindo <b class="text-slate-800 mx-1">${servidoresFiltrados.length}</b> de ${appState.servidores.length} servidores cadastrados.`;
  }

  if (servidoresFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-500 italic">
          Nenhum servidor encontrado com os critérios do filtro.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = servidoresFiltrados.map(srv => {
    const del = (appState.delegacias || []).find(d => d.id === srv.delegaciaId);
    const isDel = (srv.cargo || '').toUpperCase().includes('DELEGADO');

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3 font-bold text-slate-900">${srv.nome || 'Sem Nome'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${isDel ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-800 border-slate-300'}">
            ${srv.cargo || 'APJ'}
          </span>
        </td>
        <td class="p-3 text-slate-700 font-medium">${del ? del.nome : (srv.delegaciaNome || '-')}</td>
        <td class="p-3 text-slate-500 font-mono text-[11px]">${srv.subdivisao || '-'}</td>
        <td class="p-3 font-mono text-slate-700">${srv.telefone || '-'}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.abrirModalServidor('${srv.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow-xs transition">
            Editar
          </button>
          <button onclick="window.excluirServidor('${srv.id}')" class="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold shadow-xs transition">
            Excluir
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

window.processarAtualizacaoCSV = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const texto = e.target.result;
      const { atualizados, criados } = await processCSVImportComUpsert(texto);
      alert(`Sucesso!\n- ${atualizados} servidores tiveram sua lotação e subdivisão corrigidas.\n- ${criados} novos policiais foram adicionados.`);
      renderServidoresTable('servidores-table-container');
    } catch (err) {
      alert("Erro ao processar CSV: " + err.message);
    }
  };
  reader.readAsText(file);
};

export async function processCSVImportComUpsert(csvText) {
  const lines = csvText.split(/\r?\n/);
  let atualizados = 0;
  let criados = 0;

  let idxCargo = 0, idxNome = 1, idxSdp = 3, idxDelegacia = 4, idxTel = 5;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const sep = line.includes(';') ? ';' : ',';
    const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ''));

    // Mapeamento dinâmico dos índices de colunas com base no cabeçalho
    if (i === 0 && (parts.includes('CARGO') || parts.includes('NOME'))) {
      idxCargo = parts.indexOf('CARGO') !== -1 ? parts.indexOf('CARGO') : 0;
      idxNome = parts.indexOf('NOME') !== -1 ? parts.indexOf('NOME') : 1;
      idxSdp = parts.indexOf('SDP') !== -1 ? parts.indexOf('SDP') : 3;
      idxDelegacia = parts.indexOf('DELEGACIA') !== -1 ? parts.indexOf('DELEGACIA') : 4;
      idxTel = parts.indexOf('TELEFONE') !== -1 ? parts.indexOf('TELEFONE') : 5;
      continue;
    }

    if (parts.length >= 2) {
      const cargo = parts[idxCargo] || 'APJ';
      const nome = parts[idxNome];
      const subdivisao = parts[idxSdp] || '8ª SDP';
      const delegaciaNome = parts[idxDelegacia] || '';
      const telefone = parts[idxTel] || '';

      if (!nome || normalizeText(nome) === 'nome') continue;

      // Localiza ou cadastra a unidade correspondente
      let delObj = (appState.delegacias || []).find(d => 
        normalizeText(d.nome) === normalizeText(delegaciaNome)
      );

      if (!delObj && delegaciaNome) {
        const newDelId = 'del_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        delObj = {
          id: newDelId,
          nome: delegaciaNome,
          subdivisao: subdivisao || '8ª SDP',
          horario24h: '08:00 às 08:00',
          horario12h: '08:00 às 20:00',
          tipo: 'UNIDADE'
        };
        if (!appState.delegacias) appState.delegacias = [];
        appState.delegacias.push(delObj);
        await syncDocToFirestore('delegacias', newDelId, delObj);
      }

      // Busca servidor por nome aproximado / normalizado
      const srvExistente = (appState.servidores || []).find(s => 
        normalizeText(s.nome) === normalizeText(nome)
      );

      if (srvExistente) {
        srvExistente.cargo = cargo || srvExistente.cargo;
        srvExistente.delegaciaId = delObj ? delObj.id : srvExistente.delegaciaId;
        srvExistente.delegaciaNome = delegaciaNome || srvExistente.delegaciaNome;
        srvExistente.subdivisao = subdivisao || srvExistente.subdivisao;
        if (telefone) srvExistente.telefone = telefone;

        await syncDocToFirestore('servidores', srvExistente.id, srvExistente);
        atualizados++;
      } else {
        const newSrvId = 'srv_' + Date.now() + '_' + i;
        const novoSrv = {
          id: newSrvId,
          nome,
          cargo,
          delegaciaId: delObj ? delObj.id : '',
          delegaciaNome,
          subdivisao,
          telefone
        };

        if (!appState.servidores) appState.servidores = [];
        appState.servidores.push(novoSrv);

        await syncDocToFirestore('servidores', newSrvId, novoSrv);
        criados++;
      }
    }
  }

  return { atualizados, criados };
}

window.excluirTodosServidores = async function() {
  if (!confirm("⚠️ ATENÇÃO: Deseja realmente EXCLUIR TODOS OS SERVIDORES?")) return;

  const total = (appState.servidores || []).length;
  for (const srv of [...appState.servidores]) {
    await syncDocToFirestore('servidores', srv.id, null, true);
  }

  appState.servidores = [];
  alert(`Limpeza realizada com sucesso! ${total} servidores removidos.`);
  renderServidoresTable('servidores-table-container');
};

window.abrirModalServidor = function(servidorId = null) {
  let modal = document.getElementById('modal-servidor');
  if (!modal) {
    criarModalServidorDOM();
    modal = document.getElementById('modal-servidor');
  }

  const inputId = document.getElementById('modal-srv-id');
  const inputNome = document.getElementById('modal-srv-nome');
  const inputCargo = document.getElementById('modal-srv-cargo');
  const selectDel = document.getElementById('modal-srv-delegacia');
  const inputSub = document.getElementById('modal-srv-subdivisao');
  const inputTel = document.getElementById('modal-srv-telefone');

  let delOptions = (appState.delegacias || []).map(d => 
    `<option value="${d.id}">${d.nome}</option>`
  ).join('');
  if (selectDel) selectDel.innerHTML = delOptions;

  if (servidorId) {
    const srv = (appState.servidores || []).find(s => s.id === servidorId);
    if (srv) {
      inputId.value = srv.id;
      inputNome.value = srv.nome || '';
      inputCargo.value = srv.cargo || 'APJ';
      selectDel.value = srv.delegaciaId || (appState.delegacias[0]?.id || '');
      inputSub.value = srv.subdivisao || '';
      inputTel.value = srv.telefone || '';
    }
  } else {
    inputId.value = '';
    inputNome.value = '';
    inputCargo.value = 'APJ';
    selectDel.value = appState.delegacias[0]?.id || '';
    inputSub.value = '';
    inputTel.value = '';
  }

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-servidor')?.classList.add('hidden');
};

window.salvarServidorModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-srv-id').value;
  const nome = document.getElementById('modal-srv-nome').value.trim();
  const cargo = document.getElementById('modal-srv-cargo').value;
  const delegaciaId = document.getElementById('modal-srv-delegacia').value;
  const subdivisao = document.getElementById('modal-srv-subdivisao').value.trim();
  const telefone = document.getElementById('modal-srv-telefone').value.trim();

  if (!nome) {
    alert("Informe o nome do servidor.");
    return;
  }

  const delObj = (appState.delegacias || []).find(d => d.id === delegaciaId);

  if (id) {
    const srv = (appState.servidores || []).find(s => s.id === id);
    if (srv) {
      srv.nome = nome;
      srv.cargo = cargo;
      srv.delegaciaId = delegaciaId;
      srv.delegaciaNome = delObj ? delObj.nome : '';
      srv.subdivisao = subdivisao;
      srv.telefone = telefone;

      await syncDocToFirestore('servidores', srv.id, srv);
    }
  } else {
    const newId = 'srv_' + Date.now();
    const novoServidor = {
      id: newId,
      nome,
      cargo,
      delegaciaId,
      delegaciaNome: delObj ? delObj.nome : '',
      subdivisao,
      telefone
    };

    if (!appState.servidores) appState.servidores = [];
    appState.servidores.push(novoServidor);

    await syncDocToFirestore('servidores', novoServidor.id, novoServidor);
  }

  window.fecharModalServidor();
  renderServidoresTable('servidores-table-container');
};

window.excluirServidor = async function(servidorId) {
  const srv = (appState.servidores || []).find(s => s.id === servidorId);
  const nome = srv ? srv.nome : 'este servidor';

  if (!confirm(`Deseja realmente EXCLUIR o servidor "${nome}"?`)) return;

  appState.servidores = appState.servidores.filter(s => s.id !== servidorId);
  await syncDocToFirestore('servidores', servidorId, null, true);

  renderServidoresTable('servidores-table-container');
};

function criarModalServidorDOM() {
  const modalHTML = `
    <div id="modal-servidor" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50 font-sans">
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div class="flex items-center justify-between border-b pb-3">
          <h3 class="font-bold text-slate-900 text-sm">Cadastrar / Editar Policial</h3>
          <button onclick="window.fecharModalServidor()" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>

        <form onsubmit="window.salvarServidorModal(event)" class="space-y-3 text-xs">
          <input type="hidden" id="modal-srv-id">

          <div>
            <label class="block font-bold text-slate-700 mb-1">Nome Completo:</label>
            <input type="text" id="modal-srv-nome" required placeholder="Ex: Carlos Eduardo Silva" class="w-full border rounded-xl p-2 bg-slate-50 font-bold text-slate-900">
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Cargo / Função:</label>
              <select id="modal-srv-cargo" class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
                <option value="APJ">APJ (Agente de Pol. Judiciária)</option>
                <option value="DELEGADO DE POLICIA">Delegado de Polícia</option>
                <option value="ESCRIVAO DE POLICIA">Escrivão de Polícia</option>
                <option value="INVESTIGADOR DE POLICIA">Investigador de Polícia</option>
              </select>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Telefone / Prontidão:</label>
              <input type="text" id="modal-srv-telefone" placeholder="(00) 00000-0000" class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
            </div>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Lotação / Delegacia Principal:</label>
            <select id="modal-srv-delegacia" class="w-full border rounded-xl p-2 bg-slate-50 font-bold"></select>
          </div>

          <div>
            <label class="block font-bold text-slate-700 mb-1">Subdivisão / Regional:</label>
            <input type="text" id="modal-srv-subdivisao" placeholder="Ex: 8ª SDP" class="w-full border rounded-xl p-2 bg-slate-50 font-bold">
          </div>

          <div class="pt-3 border-t flex justify-end gap-2">
            <button type="button" onclick="window.fecharModalServidor()" class="px-4 py-2 border rounded-xl font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-xs">Salvar Servidor</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}
