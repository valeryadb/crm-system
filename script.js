/* 
   LÓGICA DO CRM - PERSISTÊNCIA EM LOCALSTORAGE (JSON)
    */

const STAGES = [
    { id: 'prospeccao', label: 'Prospecção', color: '#7b8cde' },
    { id: 'visita', label: 'Contato Inicial', color: '#4c8ce8' },
    { id: 'orcamento', label: 'Proposta Enviada', color: '#c9a84c' },
    { id: 'negociacao', label: 'Negociação', color: '#e8a94c' },
    { id: 'fechado', label: 'Fechado (Ganho)', color: '#4caf81' },
    { id: 'perdido', label: 'Perdido', color: '#e05252' }
];

// Lê o JSON do LocalStorage ao iniciar
let leads = JSON.parse(localStorage.getItem('arq_crm_leads')) || [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
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

    if (window.lucide) lucide.createIcons();
}

// ── KANBAN LOGIC ──────────────────

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
                                <span class="tag">${l.origem || 'Geral'}</span>
                            </div>
                            ${l.custo ? `<div class="card-cost">${formatCurrency(l.custo)}</div>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function allowDrop(ev) { ev.preventDefault(); }
function drag(ev, id) { ev.dataTransfer.setData("text", id); }

function drop(ev, stageId) {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("text");
    leads = leads.map(l => l.id === id ? { ...l, estagio: stageId } : l);
    persist();
    renderKanban();
    showToast("Estágio atualizado!");
}

// ── CRUD LEADS & PERSISTÊNCIA ───────────────────────────────

function saveLead() {
    const id = document.getElementById('f-lead-id').value;
    const nome = document.getElementById('f-nome').value;
    const email = document.getElementById('f-email').value;
    const telefone = document.getElementById('f-telefone').value;
    const estagio = document.getElementById('f-estagio').value;

    if (!nome || !email || !telefone || !estagio) {
        showToast("Preencha os campos obrigatórios (*)");
        return;
    }

    const leadData = {
        id: id || Date.now().toString(),
        nome: nome,
        email: email,
        telefone: telefone,
        empresa: document.getElementById('f-empresa').value,
        cargo: document.getElementById('f-cargo').value,
        origem: document.getElementById('f-origem').value,
        porte: document.getElementById('f-porte').value,
        custo: parseFloat(document.getElementById('f-custo').value) || 0,
        dor: document.getElementById('f-dor').value,
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
    showToast("Lead salvo com sucesso!");
    
    const activeNav = document.querySelector('.nav-item.active');
    const activeView = activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
    showView(activeView);
}

function editLead(id) {
    closeDetailModal();
    const l = leads.find(lead => lead.id === id);
    if (!l) return;

    document.getElementById('modal-title').innerText = "Editar Lead";
    document.getElementById('f-lead-id').value = l.id;
    document.getElementById('f-nome').value = l.nome || '';
    document.getElementById('f-email').value = l.email || '';
    document.getElementById('f-telefone').value = l.telefone || '';
    document.getElementById('f-empresa').value = l.empresa || '';
    document.getElementById('f-cargo').value = l.cargo || '';
    document.getElementById('f-origem').value = l.origem || '';
    document.getElementById('f-porte').value = l.porte || '';
    document.getElementById('f-custo').value = l.custo || 0;
    document.getElementById('f-dor').value = l.dor || '';
    document.getElementById('f-estagio').value = l.estagio || 'prospeccao';
    document.getElementById('f-retorno').value = l.retorno || '';
    document.getElementById('f-notas').value = l.notas || '';

    document.getElementById('modal-overlay').classList.add('open');
}

function deleteLead(id) {
    if (confirm("Excluir este cliente do CRM?")) {
        leads = leads.filter(l => l.id !== id);
        persist();
        const activeNav = document.querySelector('.nav-item.active');
        const activeView = activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
        showView(activeView);
        showToast("Removido com sucesso.");
    }
}

// ── DASHBOARD & INDICADORES ──────────────────────────

function renderDashboard() {
    const negociacao = leads.filter(l => ['prospeccao', 'visita', 'orcamento', 'negociacao'].includes(l.estagio));
    const fechados = leads.filter(l => l.estagio === 'fechado');
    const valorTotal = negociacao.reduce((acc, curr) => acc + curr.custo, 0);

    document.getElementById('kpi-negociacao').innerText = negociacao.length;
    document.getElementById('kpi-fechados').innerText = fechados.length;
    document.getElementById('kpi-valor-total').innerText = formatCurrency(valorTotal);

    const hoje = new Date().toISOString().split('T')[0];
    const alertas = leads.filter(l => l.retorno && l.retorno <= hoje && l.estagio !== 'fechado' && l.estagio !== 'perdido');
    
    document.getElementById('kpi-followups').innerText = alertas.length;

    const container = document.getElementById('dashboard-alerts');
    if (alertas.length === 0) {
        container.innerHTML = `<p class="empty-state">Tudo em dia!</p>`;
    } else {
        container.innerHTML = alertas.map(l => `
            <div class="alert-item ${l.retorno < hoje ? 'overdue' : 'today'}">
                <div class="alert-info">
                    <span class="alert-name">${l.nome}</span>
                    <span class="alert-meta">${l.empresa || l.telefone}</span>
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

    if (window.lucide) lucide.createIcons();
}

// ── TABELA DE LEADS ──────────────────────────────

function renderLeads() {
    const tbody = document.getElementById('leads-tbody');
    const fStage = document.getElementById('leads-filter-stage').value;
    const fOrigem = document.getElementById('leads-filter-origem').value;

    let filtered = leads;
    if (fStage) filtered = filtered.filter(l => l.estagio === fStage);
    if (fOrigem) filtered = filtered.filter(l => l.origem === fOrigem);

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Nenhum lead encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(l => {
        const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];
        return `
            <tr>
                <td><div class="td-name">${l.nome}</div><div class="td-company">${l.empresa || '-'}</div></td>
                <td><div>${l.telefone}</div><small style="color:#888;">${l.email || '-'}</small></td>
                <td>${l.origem || 'Geral'}</td>
                <td><span class="stage-pill ${l.estagio}" style="background:${stageObj.color}22; color:${stageObj.color}; padding:4px 8px; border-radius:4px;">${stageObj.label}</span></td>
                <td class="td-cost">${formatCurrency(l.custo)}</td>
                <td>${l.retorno ? formatDate(l.retorno) : '-'}</td>
                <td>
                    <div class="td-actions">
                        <button class="btn-icon" onclick="editLead('${l.id}')"><i data-lucide="pencil"></i></button>
                        <button class="btn-danger" onclick="deleteLead('${l.id}')"><i data-lucide="trash-2"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ── FOLLOW-UP ──────────────────────────

function renderFollowup() {
    const container = document.getElementById('followup-list');
    const filter = document.getElementById('followup-filter').value;
    const hoje = new Date().toISOString().split('T')[0];

    let filtered = leads.filter(l => l.retorno);
    if (filter === 'pendentes') filtered = filtered.filter(l => l.retorno <= hoje && l.estagio !== 'fechado');
    if (filter === 'hoje') filtered = filtered.filter(l => l.retorno === hoje);

    filtered.sort((a,b) => new Date(a.retorno) - new Date(b.retorno));

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-state">Sem retornos pendentes.</p>`;
        return;
    }

    container.innerHTML = filtered.map(l => {
        const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];
        return `
            <div class="followup-item ${l.retorno < hoje ? 'overdue' : (l.retorno === hoje ? 'today' : 'future')}">
                <div class="fu-info">
                    <div class="fu-name">${l.nome}</div>
                    <div class="fu-sub">${stageObj.label} | ${l.telefone}</div>
                </div>
                <div class="fu-date-wrap">
                    <span class="fu-date">${formatDate(l.retorno)}</span>
                </div>
                <div class="fu-actions">
                    <button class="btn-primary" onclick="editLead('${l.id}')">Retornar</button>
                </div>
            </div>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

// ── CONTROLE DOS MODAIS ────────────────────────────

function openLeadModal() {
    document.getElementById('modal-title').innerText = "Novo Lead";
    document.getElementById('f-lead-id').value = "";
    document.getElementById('form-lead').reset();
    document.getElementById('modal-overlay').classList.add('open');
}

function closeLeadModal(e) {
    if (!e || e.target.id === 'modal-overlay' || e.target.className === 'modal-close' || e.target.className === 'btn-secondary') {
        document.getElementById('modal-overlay').classList.remove('open');
    }
}

function openDetailModal(id) {
    const l = leads.find(lead => lead.id === id);
    if (!l) return;
    const body = document.getElementById('detail-body');
    const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];

    document.getElementById('detail-title').innerText = l.nome;
    body.innerHTML = `
        <div class="detail-grid" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
            <div class="detail-item"><strong>E-mail:</strong> ${l.email || '-'}</div>
            <div class="detail-item"><strong>Telefone:</strong> ${l.telefone || '-'}</div>
            <div class="detail-item"><strong>Empresa:</strong> ${l.empresa || '-'}</div>
            <div class="detail-item"><strong>Estágio:</strong> ${stageObj.label}</div>
            <div class="detail-item"><strong>Investimento:</strong> ${formatCurrency(l.custo)}</div>
            <div class="detail-item"><strong>Porte:</strong> ${l.porte || '-'}</div>
        </div>
        <div><strong>Dor do Cliente:</strong> <p>${l.dor || 'Não informada.'}</p></div>
        <div><strong>Notas:</strong> <p>${l.notas || 'Sem notas.'}</p></div>
    `;
    document.getElementById('detail-edit-btn').onclick = () => editLead(l.id);
    document.getElementById('detail-overlay').classList.add('open');
}

function closeDetailModal(e) {
    if (!e || e.target.id === 'detail-overlay' || e.target.className === 'modal-close' || e.target.className === 'btn-secondary') {
        document.getElementById('detail-overlay').classList.remove('open');
    }
}

// ── HELPERS & PERSISTÊNCIA ───────────────────────────────────

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
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
}

function initModalSelectors() {
    const select = document.getElementById('f-estagio');
    if (select) {
        select.innerHTML = STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    }
}

function initFilters() {
    const select = document.getElementById('leads-filter-stage');
    if (select) {
        select.innerHTML = '<option value="">Todos</option>' + STAGES.map(s => `<option value="${s.id}">${s.label}</option>`).join('');
    }
}

function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg; 
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function globalSearch(query) {
    if (!query) { showView('dashboard'); return; }
    showView('leads');
    const filtered = leads.filter(l => l.nome.toLowerCase().includes(query.toLowerCase()) || (l.empresa && l.empresa.toLowerCase().includes(query.toLowerCase())));
    const tbody = document.getElementById('leads-tbody');
    
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem;">Nenhum resultado para "${query}".</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(l => {
        const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];
        return `
            <tr>
                <td><div class="td-name">${l.nome}</div><div class="td-company">${l.empresa || '-'}</div></td>
                <td>${l.telefone}</td>
                <td>${l.origem || 'Geral'}</td>
                <td>${stageObj.label}</td>
                <td>${formatCurrency(l.custo)}</td>
                <td>${l.retorno ? formatDate(l.retorno) : '-'}</td>
                <td>
                    <button class="btn-icon" onclick="editLead('${l.id}')"><i data-lucide="pencil"></i></button>
                    <button class="btn-danger" onclick="deleteLead('${l.id}')"><i data-lucide="trash-2"></i></button>
                </td>
            </tr>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}
// ==========================================================
// 🚀 INTEGRAÇÕES RÁPIDAS CORRIGIDAS (WHATSAPP, E-MAIL E CALENDÁRIO MULTI-PLATAFORMA)
// ==========================================================

function enviarWhatsApp(telefone, nome) {
    if (!telefone) {
        showToast("Lead sem telefone cadastrado.");
        return;
    }
    const numLimpo = telefone.replace(/\D/g, '');
    const mensagem = encodeURIComponent(`Olá ${nome}, tudo bem? Gostaria de dar sequência ao nosso atendimento!`);
    window.open(`https://wa.me/55${numLimpo}?text=${mensagem}`, '_blank');
}

// E-mail corrigido: Abre o Gmail Web direto no navegador (ou Mailto como fallback)
function enviarEmail(email, nome) {
    if (!email || email === '-') {
        showToast("Lead sem e-mail cadastrado!");
        return;
    }
    const assunto = encodeURIComponent(`Acompanhamento - Atendimento ${nome}`);
    const corpo = encodeURIComponent(`Olá ${nome},\n\nConforme combinado, estou entrando em contato para dar continuidade ao nosso atendimento.\n\nFico no aguardo!`);
    
    // Tenta abrir no Gmail Web diretamente
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${assunto}&body=${corpo}`;
    window.open(gmailUrl, '_blank');
}

// Calendário Multi-Plataforma (Abre menu de escolha: Google, Apple, Notion, Outlook)
async function adicionarAoCalendario(nome, dataRetorno) {
    if (!dataRetorno) {
        showToast("Sem data de retorno definida.");
        return;
    }

    const dataFormatada = dataRetorno.replace(/-/g, ''); // Ex: 20260721
    const titulo = `Follow-up - ${nome}`;
    const detalhes = `Retornar contato com o lead ${nome}`;
    
    // Link do Google Calendar
    const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(titulo)}&dates=${dataFormatada}/${dataFormatada}&details=${encodeURIComponent(detalhes)}`;

    // Criar o arquivo de evento universal (.ics) para Apple Calendar / Notion / Outlook
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${titulo}
DESCRIPTION:${detalhes}
DTSTART;VALUE=DATE:${dataFormatada}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const file = new File([blob], `Followup_${nome}.ics`, { type: 'text/calendar' });

    // Se o navegador/celular suportar o menu de compartilhamento nativo (mostra Notion, Apple, etc.)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
            await navigator.share({
                title: titulo,
                text: detalhes,
                files: [file]
            });
            return;
        } catch (err) {
            // Se o usuário cancelar ou falhar, segue para a opção manual abaixo
        }
    }

    // Se estiver no computador, abre o Google Agenda em nova aba E baixa o arquivo .ics para Apple/Notion
    window.open(googleUrl, '_blank');
    
    // Baixa o .ics automaticamente para quem usa Notion / Apple / Outlook
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Followup_${nome}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("Abrindo Google Agenda e baixando .ics para Notion/Apple!");
}


// ==========================================================
// 🔔 RENDER FOLLOW-UP ATUALIZADO
// ==========================================================

function renderFollowup() {
    const container = document.getElementById('followup-list');
    const filter = document.getElementById('followup-filter').value;
    const hoje = new Date().toISOString().split('T')[0];

    let filtered = leads.filter(l => l.retorno);
    if (filter === 'pendentes') filtered = filtered.filter(l => l.retorno <= hoje && l.estagio !== 'fechado');
    if (filter === 'hoje') filtered = filtered.filter(l => l.retorno === hoje);

    filtered.sort((a,b) => new Date(a.retorno) - new Date(b.retorno));

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-state">Sem retornos pendentes.</p>`;
        return;
    }

    container.innerHTML = filtered.map(l => {
        const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];
        return `
            <div class="followup-item ${l.retorno < hoje ? 'overdue' : (l.retorno === hoje ? 'today' : 'future')}">
                <div class="fu-info">
                    <div class="fu-name">${l.nome}</div>
                    <div class="fu-sub">${stageObj.label} | ${l.telefone}</div>
                </div>
                <div class="fu-date-wrap">
                    <span class="fu-date">${formatDate(l.retorno)}</span>
                </div>
                <div class="fu-actions" style="display: flex; gap: 8px; align-items: center;">
                    <!-- Botão WhatsApp -->
                    <button class="btn-icon" title="Enviar WhatsApp" onclick="enviarWhatsApp('${l.telefone}', '${l.nome}')">
                        <i data-lucide="message-square"></i>
                    </button>
                    
                    <!-- Botão E-mail (Gmail Web) -->
                    <button class="btn-icon" title="Enviar E-mail via Gmail" onclick="enviarEmail('${l.email}', '${l.nome}')">
                        <i data-lucide="mail"></i>
                    </button>
                    
                    <!-- Botão Salvar na Agenda (Google / Apple / Notion / ICS) -->
                    <button class="btn-icon" title="Adicionar à Agenda (Google, Apple, Notion)" onclick="adicionarAoCalendario('${l.nome}', '${l.retorno}')">
                        <i data-lucide="calendar"></i>
                    </button>

                    <!-- Botão de Editar / Retornar -->
                    <button class="btn-primary" onclick="editLead('${l.id}')">Retornar</button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}
