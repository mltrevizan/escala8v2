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
          <button onclick="window.editarServidor('${srv.id}')" class="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold">
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

// Importador e Parser de CSV
export async function processCSVImport(csvText) {
  const lines = csvText.split(/\r\n|\n/);
  if (lines.length < 2) throw new Error("O arquivo CSV enviado está vazio ou fora do formato esperado.");

  const headers = lines[0].split(';').map(h => normalizeText(h.trim()));
  let count = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';').map(c => c.trim());
    if (cols.length < 2) continue;

    const nome = cols[0] || '';
    const cargo = cols[1] || 'AGENTE';
    const login = cols[2] || normalizeText(nome.split(' ')[0]);
    const delegaciaId = cols[3] || 'DEL_8SDP_P';
    const telefone = cols[4] || '';
    const nivelAcesso = cols[5] || 'APJ';

    const srvId = 'srv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

    const newServidor = {
      id: srvId,
      nome: nome.toUpperCase(),
      cargo: cargo.toUpperCase(),
      login: login.toLowerCase(),
      delegaciaId: delegaciaId,
      telefone: telefone,
      nivelAcesso: nivelAcesso,
      sdpId: '8SDP'
    };

    appState.servidores.push(newServidor);
    await syncDocToFirestore('servidores', newServidor.id, newServidor);
    count++;
  }

  return count;
}
