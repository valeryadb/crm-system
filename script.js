/* ==============================================
   LÓGICA CRM — ENGENHARIA ALTO PADRÃO
============================================== */

const STAGES = [
    { id: 'prospeccao', label: 'Prospecção', color: '#7b8cde' },
    { id: 'visita', label: 'Visita Técnica', color: '#4c8ce8' },
    { id: 'orcamento', label: 'Orçamento Enviado', color: '#c9a84c' },
    { id: 'negociacao', label: 'Negociação', color: '#e8a94c' },
    { id: 'fechado', label: 'Fechado', color: '#4caf81' },
    { id: 'perdido', label: 'Perdido', color: '#e05252' }
];

let leads = JSON.parse(localStorage.getItem('arq_crm_leads')) || [];

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    initModalSelectors();
    initFilters();
    renderDashboard();
    updateFollowupBadge();
});

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');
    
    const targetNav = document.querySelector(`[data-view="${viewName}"]`);
    if (targetNav) targetNav.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'kanban': 'Funil de Vendas',
        'followup': 'Follow-up',
        'leads': 'Gestão de Leads'
    };
    document.getElementById('page-title').innerText = titles[viewName];

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'kanban') renderKanban();
    if (viewName === 'followup') renderFollowup();
    if (viewName === 'leads') renderLeads();

    lucide.createIcons();
}

// ── KANBAN LOGIC (REVISADA) ──────────────────

function renderKanban() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    const filtroOrigem = document.getElementById('kanban-filter-origem').value;
    
    board.innerHTML = STAGES.map(stage => {
        const stageLeads = leads.filter(l => l.estagio === stage.id && (!filtroOrigem || l.origem === filtroOrigem));
        
        return `
            <div class="kanban-col" ondragover="allowDrop(event)" ondrop="drop(event, '${stage.id}')">
                <div class="kanban-col-header">
                    <span class="col-title"><span class="col-dot" style="background:${stage.color}"></span>${stage.label}</span>
                    <span class="col-count">${stageLeads.length}</span>
                </div>
                <div class="kanban-cards">
                    ${stageLeads.length === 0 ? '<p class="kanban-empty">Sem leads aqui</p>' : stageLeads.map(l => `
                        <div class="lead-card" draggable="true" ondragstart="drag(event, '${l.id}')" onclick="openDetailModal('${l.id}')">
                            <div class="card-name">${l.nome}</div>
                            ${l.empresa ? `<div class="card-company">${l.empresa}</div>` : ''}
                            <div class="card-meta">
                                <span class="tag ${getOrigemClass(l.origem)}">${l.origem}</span>
                            </div>
                            ${l.custo ? `<div class="card-cost">${formatCurrency(l.custo)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// Funções de Arrastar e Soltar
function allowDrop(ev) {
    ev.preventDefault();
}

function drag(ev, id) {
    ev.dataTransfer.setData("text", id);
}

function drop(ev, stageId) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text");
    leads = leads.map(l => l.id === id ? { ...l, estagio: stageId } : l);
    persist();
    renderKanban();
    showToast("Estágio atualizado!");
}

// ── CRUD LEADS ───────────────────────────────

function saveLead() {
    const id = document.getElementById('f-lead-id').value;
    const nome = document.getElementById('f-nome').value;
    const telefone = document.getElementById('f-telefone').value;
    const estagio = document.getElementById('f-estagio').value;

    if (!nome || !telefone || !estagio) {
        showToast("Preencha os campos obrigatórios (*)");
        return;
    }

    const leadData = {
        id: id || Date.now().toString(),
        nome: nome,
        empresa: document.getElementById('f-empresa').value,
        telefone: telefone,
        origem: document.getElementById('f-origem').value,
        metragem: document.getElementById('f-metragem').value,
        custo: parseFloat(document.getElementById('f-custo').value) || 0,
        tipoObra: document.getElementById('f-tipo-obra').value,
        estagio: estagio,
        retorno: document.getElementById('f-retorno').value,
        notas: document.getElementById('f-notas').value,
        updatedAt: new Date().toISOString()
    };

    if (id) {
        leads = leads.map(l => l.id === id ? leadData : l);
    } else {
        leads.push(leadData);
    }

    persist();
    closeLeadModal();
    showToast("Lead salvo!");
    
    const activeView = document.querySelector('.nav-item.active').getAttribute('data-view');
    showView(activeView);
}

function deleteLead(id) {
    if (confirm("Excluir este lead?")) {
        leads = leads.filter(l => l.id !== id);
        persist();
        const activeView = document.querySelector('.nav-item.active').getAttribute('data-view');
        showView(activeView);
        showToast("Removido.");
    }
}

// ── RENDER DASHBOARD ──────────────────────────

function renderDashboard() {
    const negociacao = leads.filter(l => ['prospeccao', 'visita', 'orcamento', 'negociacao'].includes(l.estagio));
    const fechados = leads.filter(l => l.estagio === 'fechado');
    const valorTotal = negociacao.reduce((acc, curr) => acc + curr.custo, 0);

    document.getElementById('kpi-negociacao').innerText = negociacao.length;
    document.getElementById('kpi-fechados').innerText = fechados.length;
    document.getElementById('kpi-valor-total').innerText = formatCurrency(valorTotal);

    const hoje = new Date().toISOString().split('T')[0];
    const alertas = leads.filter(l => l.retorno && l.retorno <= hoje && l.estagio !== 'fechado' && l.estagio !== 'perdido');
    
    const container = document.getElementById('dashboard-alerts');
    if (alertas.length === 0) {
        container.innerHTML = `<p class="empty-state">Tudo em dia!</p>`;
    } else {
        container.innerHTML = alertas.map(l => `
            <div class="alert-item ${l.retorno < hoje ? 'overdue' : 'today'}">
                <div class="alert-info">
                    <span class="alert-name">${l.nome}</span>
                    <span class="alert-meta">${l.origem}</span>
                </div>
                <span class="alert-date">${l.retorno < hoje ? 'ATRASADO' : 'HOJE'}</span>
                <button class="btn-icon" onclick="editLead('${l.id}')"><i data-lucide="pencil"></i></button>
            </div>
        `).join('');
    }

    const summaryContainer = document.getElementById('funnel-summary');
    summaryContainer.innerHTML = STAGES.map(s => {
        const count = leads.filter(l => l.estagio === s.id).length;
        return `<div class="funnel-pill"><span class="pill-count">${count}</span><span class="pill-label">${s.label}</span></div>`;
    }).join('');

    lucide.createIcons();
}

// ── RENDER LEADS ──────────────────────────────

function renderLeads() {
    const tbody = document.getElementById('leads-tbody');
    const fStage = document.getElementById('leads-filter-stage').value;
    const fOrigem = document.getElementById('leads-filter-origem').value;

    let filtered = leads;
    if (fStage) filtered = filtered.filter(l => l.estagio === fStage);
    if (fOrigem) filtered = filtered.filter(l => l.origem === fOrigem);

    tbody.innerHTML = filtered.map(l => `
        <tr>
            <td><div class="td-name">${l.nome}</div><div class="td-company">${l.empresa || '-'}</div></td>
            <td>${l.telefone}</td>
            <td>${l.origem}</td>
            <td><span class="stage-pill ${l.estagio}">${STAGES.find(s=>s.id===l.estagio).label}</span></td>
            <td>${l.metragem || '-'} m²</td>
            <td class="td-cost">${formatCurrency(l.custo)}</td>
            <td>${l.retorno ? formatDate(l.retorno) : '-'}</td>
            <td>
                <div class="td-actions">
                    <button class="btn-icon" onclick="editLead('${l.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-danger" onclick="deleteLead('${l.id}')"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
    lucide.createIcons();
}

// ── RENDER FOLLOW-UP ──────────────────────────

function renderFollowup() {
    const container = document.getElementById('followup-list');
    const filter = document.getElementById('followup-filter').value;
    const hoje = new Date().toISOString().split('T')[0];

    let filtered = leads.filter(l => l.retorno);
    if (filter === 'pendentes') filtered = filtered.filter(l => l.retorno <= hoje && l.estagio !== 'fechado');
    if (filter === 'hoje') filtered = filtered.filter(l => l.retorno === hoje);

    filtered.sort((a,b) => new Date(a.retorno) - new Date(b.retorno));

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-state">Sem retornos.</p>`;
        return;
    }

    container.innerHTML = filtered.map(l => `
        <div class="followup-item ${l.retorno < hoje ? 'overdue' : (l.retorno === hoje ? 'today' : 'future')}">
            <div class="fu-info">
                <div class="fu-name">${l.nome}</div>
                <div class="fu-sub">${STAGES.find(s=>s.id===l.estagio).label} | ${l.telefone}</div>
            </div>
            <div class="fu-date-wrap">
                <span class="fu-date">${formatDate(l.retorno)}</span>
            </div>
            <div class="fu-actions">
                <button class="btn-primary" onclick="editLead('${l.id}')">Retornar</button>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// ── MODAL CONTROLS ────────────────────────────

function openLeadModal() {
    document.getElementById('modal-title').innerText = "Novo Lead";
    document.getElementById('f-lead-id').value = "";
    document.querySelectorAll('.modal-body input, .modal-body select, .modal-body textarea').forEach(el => el.value = "");
    document.getElementById('modal-overlay').classList.add('open');
}

function closeLeadModal(e) {
    if (!e || e.target.id === 'modal-overlay' || e.target.className === 'modal-close' || e.target.className === 'btn-secondary') {
        document.getElementById('modal-overlay').classList.remove('open');
    }
}

function editLead(id) {
    const l = leads.find(lead => lead.id === id);
    if (!l) return;
    closeDetailModal();
    document.getElementById('modal-title').innerText = "Editar Lead";
    document.getElementById('f-lead-id').value = l.id;
    document.getElementById('f-nome').value = l.nome;
    document.getElementById('f-empresa').value = l.empresa;
    document.getElementById('f-telefone').value = l.telefone;
    document.getElementById('f-origem').value = l.origem;
    document.getElementById('f-metragem').value = l.metragem;
    document.getElementById('f-custo').value = l.custo;
    document.getElementById('f-tipo-obra').value = l.tipoObra;
    document.getElementById('f-estagio').value = l.estagio;
    document.getElementById('f-retorno').value = l.retorno;
    document.getElementById('f-notas').value = l.notas;
    document.getElementById('modal-overlay').classList.add('open');
}

function openDetailModal(id) {
    const l = leads.find(lead => lead.id === id);
    if (!l) return;
    const body = document.getElementById('detail-body');
    document.getElementById('detail-title').innerText = l.nome;
    body.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item"><span class="detail-label">Empresa</span><span class="detail-value">${l.empresa || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Estágio</span><span class="detail-value">${STAGES.find(s=>s.id===l.estagio).label}</span></div>
            <div class="detail-item"><span class="detail-label">Investimento</span><span class="detail-value">${formatCurrency(l.custo)}</span></div>
        </div>
        <div class="detail-notes">${l.notas || 'Sem notas.'}</div>
    `;
    document.getElementById('detail-edit-btn').onclick = () => editLead(l.id);
    document.getElementById('detail-overlay').classList.add('open');
}

function closeDetailModal(e) {
    if (!e || e.target.id === 'detail-overlay' || e.target.className === 'modal-close' || e.target.className === 'btn-secondary') {
        document.getElementById('detail-overlay').classList.remove('open');
    }
}

// ── HELPERS ───────────────────────────────────

function persist() {
    localStorage.setItem('arq_crm_leads', JSON.stringify(leads));
    updateFollowupBadge();
}

function updateFollowupBadge() {
    const hoje = new Date().toISOString().split('T')[0];
    const count = leads.filter(l => l.retorno && l.retorno <= hoje && l.estagio !== 'fechado' && l.estagio !== 'perdido').length;
    const badge = document.getElementById('followup-badge');
    if (badge) {
        badge.innerText = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

function formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function getOrigemClass(origem) {
    if (origem === 'Arquiteto') return 'origem-arq';
    if (origem === 'Indicação') return 'origem-ind';
    if (origem === 'Prospecção Ativa') return 'origem-pro';
    return '';
}

function initModalSelectors() {
    const select = document.getElementById('f-estagio');
    select.innerHTML = STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

function initFilters() {
    const select = document.getElementById('leads-filter-stage');
    select.innerHTML = '<option value="">Todos</option>' + STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function globalSearch(query) {
    if (!query) { showView('dashboard'); return; }
    showView('leads');
    const filtered = leads.filter(l => l.nome.toLowerCase().includes(query.toLowerCase()));
    const tbody = document.getElementById('leads-tbody');
    tbody.innerHTML = filtered.map(l => `<tr><td>${l.nome}</td><td>${l.telefone}</td><td>${l.origem}</td><td>${l.estagio}</td><td>-</td><td>-</td><td>-</td><td>-</td></tr>`).join('');
}