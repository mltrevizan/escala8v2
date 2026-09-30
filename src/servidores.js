// src/servidores.js
import { appState, normalizeText } from './state.js';
import { syncDocToFirestore } from './db.js';

export function renderServidoresTable(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (appState.servidores.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-500 text-sm">
        Nenhum servidor cadastrado até o momento.
      </div>
    `;
    return;
  }

  let html = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead>
          <tr class="bg-slate-100 text-slate-700 border-b font-bold uppercase tracking-wider">
            <th class="p-3">Nome / Cargo</th>
            <th class="p-3">Login / Contato</th>
            <th class="p-3">Lotação (Delegacia)</th>
            <th class="p-3">Nível de Acesso</th>
            <th class="p-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
  `;

  appState.servidores.forEach(srv => {
    html += `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3">
          <div class="font-bold text-slate-800">${srv.nome || 'SEM NOME'}</div>
          <div class="text-[10px] text-slate-500">${srv.cargo || 'Não Informado'}</div>
        </td>
        <td class="p-3">
          <div class="font-mono text-slate-700">${srv.login || '-'}</div>
          <div class="text-[10px] text-slate-500">${srv.telefone || '-'}</div>
        </td>
        <td class="p-3 text-slate-700 font-medium">
          ${srv.delegaciaId || 'Não Vinculado'}
        </td>
        <td class="p-3">
          <span class="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${getRoleBadgeClass(srv.nivelAcesso)}">
            ${srv.nivelAcesso || 'APJ'}
          </span>
        </td>
        <td class="p-3 text-right space-x-1">
          <button onclick="window.editarServidor('${srv.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold shadow">
            Editar
          </button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;
}

function getRoleBadgeClass(role) {
  switch (role) {
    case 'ADMINISTRADOR': return 'bg-purple-100 text-purple-800 border border-purple-300';
    case 'COORDENADOR': return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'SUPERINTENDENTE': return 'bg-indigo-100 text-indigo-800 border border-indigo-300';
    case 'DELEGADO': return 'bg-amber-100 text-amber-800 border border-amber-300';
    default: return 'bg-slate-100 text-slate-700 border border-slate-300';
  }
}

// Modal de Edição de Servidor
window.editarServidor = function(servidorId) {
  const srv = appState.servidores.find(s => s.id === servidorId);
  if (!srv) return;

  const modal = document.getElementById('modal-servidor');
  if (!modal) return;

  document.getElementById('modal-srv-id').value = srv.id;
  document.getElementById('modal-srv-nome').value = srv.nome || '';
  document.getElementById('modal-srv-cargo').value = srv.cargo || 'AGENTE';
  document.getElementById('modal-srv-login').value = srv.login || '';
  document.getElementById('modal-srv-telefone').value = srv.telefone || '';
  document.getElementById('modal-srv-nivel').value = srv.nivelAcesso || 'APJ';

  const selectDelegacia = document.getElementById('modal-srv-delegacia');
  if (selectDelegacia) {
    selectDelegacia.innerHTML = appState.delegacias
      .map(d => `<option value="${d.nome}" ${d.nome === srv.delegaciaId ? 'selected' : ''}>${d.nome}</option>`)
      .join('');
  }

  modal.classList.remove('hidden');
};

window.fecharModalServidor = function() {
  document.getElementById('modal-servidor')?.classList.add('hidden');
};

window.salvarServidorModal = async function(e) {
  e.preventDefault();

  const id = document.getElementById('modal-srv-id').value;
  const srvObj = appState.servidores.find(s => s.id === id);

  if (srvObj) {
    srvObj.nome = document.getElementById('modal-srv-nome').value.toUpperCase();
    srvObj.cargo = document.getElementById('modal-srv-cargo').value.toUpperCase();
    srvObj.login = document.getElementById('modal-srv-login').value.toLowerCase();
    srvObj.telefone = document.getElementById('modal-srv-telefone').value;
    srvObj.delegaciaId = document.getElementById('modal-srv-delegacia').value;
    srvObj.nivelAcesso = document.getElementById('modal-srv-nivel').value;

    await syncDocToFirestore('servidores', srvObj.id, srvObj);

    window.fecharModalServidor();
    renderServidoresTable('servidores-table-container');
    alert("Dados do policial atualizados com sucesso!");
  }
};

// Importador CSV
export async function processCSVImport(csvText) {
  const lines = csvText.split(/\r\n|\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) throw new Error("O arquivo CSV enviado está vazio ou fora do formato esperado.");

  const delimiter = lines[0].includes(';') ? ';' : ',';

  const parseLine = (line) => {
    const regex = new RegExp(`(?:^|${delimiter})(?:"([^"]*)"|([^"${delimiter}]*))`, 'g');
    const matches = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push((match[1] !== undefined ? match[1] : match[2]).trim());
    }
    return matches;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => normalizeText(h));

  const colIndex = {
    nome: headers.findIndex(h => h.includes('nome')),
    cargo: headers.findIndex(h => h.includes('cargo')),
    login: headers.findIndex(h => h.includes('login')),
    sdp: headers.findIndex(h => h.includes('sdp')),
    delegacia: headers.findIndex(h => h.includes('delegacia') || h.includes('lotacao')),
    telefone: headers.findIndex(h => h.includes('telefone') || h.includes('celular')),
    funcaoCRF: headers.findIndex(h => h.includes('funcao_crf') || h.includes('crf')),
    funcaoDP: headers.findIndex(h => h.includes('funcao_dp') || h.includes('dp')),
    nivelAcesso: headers.findIndex(h => h.includes('nivel') || h.includes('acesso'))
  };

  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    if (cols.length < 2) continue;

    const nome = colIndex.nome !== -1 ? cols[colIndex.nome] : cols[1];
    if (!nome) continue;

    const cargo = colIndex.cargo !== -1 ? cols[colIndex.cargo] : cols[0];
    const login = colIndex.login !== -1 ? cols[colIndex.login] : normalizeText(nome.split(' ')[0]);
    const sdpId = colIndex.sdp !== -1 ? cols[colIndex.sdp] : '8SDP';
    const delegaciaId = colIndex.delegacia !== -1 ? cols[colIndex.delegacia] : 'DEL_8SDP_P';
    const telefone = colIndex.telefone !== -1 ? cols[colIndex.telefone] : '';
    const funcaoCRF = colIndex.funcaoCRF !== -1 ? cols[colIndex.funcaoCRF] : 'OPERACIONAL';
    const funcaoDP = colIndex.funcaoDP !== -1 ? cols[colIndex.funcaoDP] : 'OPERACIONAL';
    const nivelAcesso = colIndex.nivelAcesso !== -1 ? cols[colIndex.nivelAcesso] : 'APJ';

    const srvId = 'srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const newServidor = {
      id: srvId,
      nome: nome.toUpperCase(),
      cargo: cargo.toUpperCase(),
      login: login.toLowerCase(),
      sdpId: sdpId,
      delegaciaId: delegaciaId,
      telefone: telefone,
      funcaoCRF: funcaoCRF,
      funcaoDP: funcaoDP,
      nivelAcesso: nivelAcesso
    };

    appState.servidores.push(newServidor);
    await syncDocToFirestore('servidores', newServidor.id, newServidor);
    count++;
  }

  return count;
}
