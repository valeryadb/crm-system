/* ==========================================================
   SYSTEM CRM - LÓGICA CORE, HISTÓRICO E GESTÃO DE LEADS
   ========================================================== */

const STAGES = [
    { id: 'prospeccao', label: 'Prospecção', color: '#7b8cde' },
    { id: 'visita', label: 'Contato Inicial', color: '#4c8ce8' },
    { id: 'orcamento', label: 'Proposta Enviada', color: '#c9a84c' },
    { id: 'negociacao', label: 'Negociação', color: '#e8a94c' },
    { id: 'fechado', label: 'Fechado (Ganho)', color: '#4caf81' },
    { id: 'perdido', label: 'Perdido', color: '#e05252' }
];

let leads = JSON.parse(localStorage.getItem('arq_crm_leads')) || [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    initModalSelectors();
    initFilters();
    renderDashboard();
    updateFollowupBadge();
});

// ── NAVEGAÇÃO DE VIEWS ──────────────────────────────────────────────

function showView(viewName) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) targetView.classList.add('active');
    
    const targetNav = document.querySelector(`[data-view="${viewName}"]`);
    if (targetNav) targetNav.classList.add('active');

    const titles = {
        'dashboard': 'Dashboard',
        'kanban': 'Funil de Vendas',
        'followup': 'Follow-up & Régua de Retorno',
        'leads': 'Gestão de Leads'
    };
    document.getElementById('page-title').innerText = titles[viewName];

    if (viewName === 'dashboard') renderDashboard();
    if (viewName === 'kanban') renderKanban();
    if (viewName === 'followup') renderFollowup();
    if (viewName === 'leads') renderLeads();

    if (window.lucide) lucide.createIcons();
}

// ── REGRAS DE NEGÓCIO: SLA E ANIVERSÁRIO ────────────────────────────

function isBirthdayToday(birthDateStr) {
    if (!birthDateStr) return false;
    const today = new Date();
    const [, month, day] = birthDateStr.split('-');
    return (today.getMonth() + 1) === parseInt(month, 10) && today.getDate() === parseInt(day, 10);
}

function calculateSLAStatus(returnDateStr) {
    if (!returnDateStr) return { label: 'Sem Agendamento', class: 'sla-neutral', days: 0 };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = returnDateStr.split('-');
    const targetDate = new Date(year, month - 1, day);
    
    const timeDiff = today - targetDate;
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    if (daysDiff === 0) return { label: 'Atender Hoje', class: 'sla-today', days: 0 };
    if (daysDiff > 0 && daysDiff <= 1) return { label: 'Atrasado +24h', class: 'sla-warning', days: daysDiff };
    if (daysDiff > 1 && daysDiff <= 7) return { label: `Atrasado ${daysDiff} dias`, class: 'sla-danger', days: daysDiff };
    if (daysDiff > 7 && daysDiff <= 15) return { label: 'Sem contato +15 dias', class: 'sla-critical', days: daysDiff };
    if (daysDiff > 15) return { label: 'Sem retorno (+30 dias)', class: 'sla-cold', days: daysDiff };

    return { label: `Agendado (${formatDate(returnDateStr)})`, class: 'sla-ok', days: daysDiff };
}

// ── INTEGRAÇÕES DE COMUNICAÇÃO E AGENDA ────────────────────────────

function sendWhatsAppMessage(phone, name, customText = '') {
    if (!phone) {
        showToast("Lead sem telefone cadastrado.");
        return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const defaultText = `Olá ${name}, tudo bem? Gostaria de dar sequência ao nosso atendimento.`;
    const message = encodeURIComponent(customText || defaultText);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
}

function sendBirthdayMessage(phone, name) {
    const message = `Parabéns, ${name}! A nossa equipe te deseja um feliz aniversário! Como presente, preparamos um cupom especial de desconto para você: NIVER10. Aproveite!`;
    sendWhatsAppMessage(phone, name, message);
}

function sendPromoCoupon(phone, name, couponCode = 'PROMO10') {
    const message = `Olá ${name}! Estamos com uma condição especial esta semana. Use o cupom ${couponCode} e garanta condições exclusivas em nosso atendimento.`;
    sendWhatsAppMessage(phone, name, message);
}

function sendEmailGmail(email, name) {
    if (!email) {
        showToast("Lead sem e-mail cadastrado.");
        return;
    }
    const subject = encodeURIComponent(`Acompanhamento - Atendimento ${name}`);
    const body = encodeURIComponent(`Olá ${name},\n\nConforme combinado, estou entrando em contato para dar continuidade ao nosso processo.\n\nFico no aguardo!`);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${subject}&body=${body}`;
    window.open(gmailUrl, '_blank');
}

function scheduleGoogleCalendar(name, email, returnDateStr) {
    if (!returnDateStr) {
        showToast("Sem data de retorno definida.");
        return;
    }
    const cleanDate = returnDateStr.replace(/-/g, '');
    const startDate = `${cleanDate}T100000Z`;
    const endDate = `${cleanDate}T110000Z`;
    
    const title = encodeURIComponent(`Reunião de Alinhamento - ${name}`);
    const details = encodeURIComponent(`Reunião de acompanhamento agendada via CRM para o cliente ${name}.`);
    
    let googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}`;
    if (email) {
        googleUrl += `&add=${encodeURIComponent(email)}`;
    }
    window.open(googleUrl, '_blank');
}

function downloadICSInvite(name, email, returnDateStr) {
    if (!returnDateStr) {
        showToast("Sem data de retorno definida.");
        return;
    }
    const cleanDate = returnDateStr.replace(/-/g, '');
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//SystemCRM//BR
BEGIN:VEVENT
SUMMARY:Reunião com ${name}
DESCRIPTION:Acompanhamento comercial via SystemCRM.
ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${email || 'cliente@email.com'}
DTSTART:${cleanDate}T100000Z
DTEND:${cleanDate}T110000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `Reuniao_${name}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Convite de agenda (.ics) baixado.");
}

// ── CRUD E PERSISTÊNCIA DOS LEADS ──────────────────────────────────

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

    const existingLead = leads.find(l => l.id === id);
    const initialNotesText = document.getElementById('f-notas').value.trim();
    
    let historyArray = existingLead ? (existingLead.historicoNotas || []) : [];

    // Se for um novo cadastro e tiver nota digitada, adiciona ao histórico
    if (!existingLead && initialNotesText) {
        historyArray.unshift({
            id: Date.now().toString(),
            texto: initialNotesText,
            dataHora: new Date().toISOString()
        });
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
        nascimento: document.getElementById('f-nascimento').value,
        retorno: document.getElementById('f-retorno').value,
        historicoNotas: historyArray,
        updatedAt: new Date().toISOString()
    };

    if (id) {
        leads = leads.map(l => l.id === id ? leadData : l);
    } else {
        leads.push(leadData);
    }

    persistData();
    closeLeadModal();
    showToast("Lead salvo com sucesso.");
    
    const activeNav = document.querySelector('.nav-item.active');
    const activeView = activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
    showView(activeView);
}

function editLead(id) {
    closeDetailModal();
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    document.getElementById('modal-title').innerText = "Editar Lead";
    document.getElementById('f-lead-id').value = lead.id;
    document.getElementById('f-nome').value = lead.nome || '';
    document.getElementById('f-email').value = lead.email || '';
    document.getElementById('f-telefone').value = lead.telefone || '';
    document.getElementById('f-empresa').value = lead.empresa || '';
    document.getElementById('f-cargo').value = lead.cargo || '';
    document.getElementById('f-origem').value = lead.origem || '';
    document.getElementById('f-porte').value = lead.porte || '';
    document.getElementById('f-custo').value = lead.custo || 0;
    document.getElementById('f-dor').value = lead.dor || '';
    document.getElementById('f-estagio').value = lead.estagio || 'prospeccao';
    document.getElementById('f-nascimento').value = lead.nascimento || '';
    document.getElementById('f-retorno').value = lead.retorno || '';
    document.getElementById('f-notas').value = '';

    document.getElementById('modal-overlay').classList.add('open');
}

function deleteLead(id) {
    if (confirm("Deseja realmente excluir este lead?")) {
        leads = leads.filter(l => l.id !== id);
        persistData();
        const activeNav = document.querySelector('.nav-item.active');
        const activeView = activeNav ? activeNav.getAttribute('data-view') : 'dashboard';
        showView(activeView);
        showToast("Lead removido com sucesso.");
    }
}

// ── REGISTRO DE NOTAS NA TIMELINE ──────────────────────────────────

function adicionarNotaTimeline(leadId) {
    const inputNota = document.getElementById('input-nova-nota');
    if (!inputNota || !inputNota.value.trim()) {
        showToast("Digite uma anotação antes de registrar.");
        return;
    }

    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    if (!lead.historicoNotas) {
        lead.historicoNotas = [];
    }

    const novaNota = {
        id: Date.now().toString(),
        texto: inputNota.value.trim(),
        dataHora: new Date().toISOString()
    };

    lead.historicoNotas.unshift(novaNota);

    persistData();
    inputNota.value = '';
    openDetailModal(leadId);
    showToast("Anotação registrada na timeline.");
}

// ── RENDERIZAÇÃO DAS TELAS ──────────────────────────────────────────

function renderDashboard() {
    const inNegotiation = leads.filter(l => ['prospeccao', 'visita', 'orcamento', 'negociacao'].includes(l.estagio));
    const closedDeals = leads.filter(l => l.estagio === 'fechado');
    const totalAmount = inNegotiation.reduce((acc, curr) => acc + curr.custo, 0);

    document.getElementById('kpi-negociacao').innerText = inNegotiation.length;
    document.getElementById('kpi-fechados').innerText = closedDeals.length;
    document.getElementById('kpi-valor-total').innerText = formatCurrency(totalAmount);

    const todayStr = new Date().toISOString().split('T')[0];
    const alerts = leads.filter(l => l.retorno && l.retorno <= todayStr && l.estagio !== 'fechado' && l.estagio !== 'perdido');
    document.getElementById('kpi-followups').innerText = alerts.length;

    const alertsContainer = document.getElementById('dashboard-alerts');
    if (alerts.length === 0) {
        alertsContainer.innerHTML = `<p class="empty-state">Nenhum follow-up urgente pendente.</p>`;
    } else {
        alertsContainer.innerHTML = alerts.map(l => `
            <div class="alert-item ${l.retorno < todayStr ? 'overdue' : 'today'}">
                <div class="alert-info">
                    <span class="alert-name">${l.nome}</span>
                    <span class="alert-meta">${l.empresa || l.telefone}</span>
                </div>
                <span class="alert-date">${l.retorno < todayStr ? 'ATRASADO' : 'HOJE'}</span>
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

function renderKanban() {
    const board = document.getElementById('kanban-board');
    if (!board) return;
    const filterOrigem = document.getElementById('kanban-filter-origem').value;

    board.innerHTML = STAGES.map(stage => {
        const stageLeads = leads.filter(l => l.estagio === stage.id && (!filterOrigem || l.origem === filterOrigem));
        return `
            <div class="kanban-col" ondragover="allowDrop(event)" ondrop="drop(event, '${stage.id}')">
                <div class="kanban-col-header">
                    <span class="col-title"><span class="col-dot" style="background:${stage.color}"></span>${stage.label}</span>
                    <span class="col-count">${stageLeads.length}</span>
                </div>
                <div class="kanban-cards">
                    ${stageLeads.length === 0 ? '<p class="kanban-empty">Sem leads nesta etapa</p>' : stageLeads.map(l => `
                        <div class="lead-card" draggable="true" ondragstart="drag(event, '${l.id}')" onclick="openDetailModal('${l.id}')">
                            <div class="card-name">${l.nome} ${isBirthdayToday(l.nascimento) ? '(Aniversariante)' : ''}</div>
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

function renderFollowup() {
    const container = document.getElementById('followup-list');
    const filter = document.getElementById('followup-filter').value;
    const todayStr = new Date().toISOString().split('T')[0];

    let filtered = leads.filter(l => l.retorno || l.nascimento);

    if (filter === 'pendentes') filtered = filtered.filter(l => l.retorno <= todayStr && l.estagio !== 'fechado');
    if (filter === 'hoje') filtered = filtered.filter(l => l.retorno === todayStr);

    if (filtered.length === 0) {
        container.innerHTML = `<p class="empty-state">Nenhum follow-up pendente.</p>`;
        return;
    }

    container.innerHTML = filtered.map(l => {
        const stageObj = STAGES.find(s => s.id === l.estagio) || STAGES[0];
        const sla = calculateSLAStatus(l.retorno);
        const hasBirthday = isBirthdayToday(l.nascimento);

        return `
            <div class="followup-item ${l.retorno < todayStr ? 'overdue' : (l.retorno === todayStr ? 'today' : 'future')}" style="padding: 15px; border-radius: 8px; margin-bottom: 12px; background: #1a1d26; display: flex; justify-content: space-between; align-items: center;">
                <div class="fu-info">
                    <div class="fu-name" style="font-weight: bold; font-size: 1.1rem; color: #fff;">
                        ${l.nome} ${hasBirthday ? '<span style="font-size:0.8rem; background:#e8a94c; color:#000; padding:2px 6px; border-radius:4px; margin-left:8px;">ANIVERSÁRIO HOJE</span>' : ''}
                    </div>
                    <div class="fu-sub" style="color: #aaa; font-size: 0.9rem; margin-top: 4px;">
                        ${stageObj.label} | ${l.telefone} | <span class="badge-sla ${sla.class}">${sla.label}</span>
                    </div>
                </div>

                <div class="fu-actions" style="display: flex; gap: 8px; align-items: center;">
                    ${hasBirthday ? `
                        <button class="btn-primary" style="background:#e8a94c; color:#000;" title="Mandar Parabéns + Cupom" onclick="sendBirthdayMessage('${l.telefone}', '${l.nome}')">
                            Mandar Parabéns
                        </button>
                    ` : ''}

                    <button class="btn-icon" title="Enviar Cupom de Promoção" onclick="sendPromoCoupon('${l.telefone}', '${l.nome}', 'PROMO10')">
                        <i data-lucide="tag"></i>
                    </button>

                    <button class="btn-icon" title="Enviar WhatsApp" onclick="sendWhatsAppMessage('${l.telefone}', '${l.nome}')">
                        <i data-lucide="message-square"></i>
                    </button>
                    
                    <button class="btn-icon" title="Enviar E-mail via Gmail" onclick="sendEmailGmail('${l.email}', '${l.nome}')">
                        <i data-lucide="mail"></i>
                    </button>

                    <button class="btn-icon" title="Agendar Reunião no Google Calendar" onclick="scheduleGoogleCalendar('${l.nome}', '${l.email}', '${l.retorno}')">
                        <i data-lucide="calendar"></i>
                    </button>

                    <button class="btn-icon" title="Baixar Convite .ICS (Apple/Notion/Outlook)" onclick="downloadICSInvite('${l.nome}', '${l.email}', '${l.retorno}')">
                        <i data-lucide="download"></i>
                    </button>

                    <button class="btn-primary" onclick="editLead('${l.id}')">Atualizar Retorno</button>
                </div>
            </div>
        `;
    }).join('');

    if (window.lucide) lucide.createIcons();
}

function renderLeads() {
    const tbody = document.getElementById('leads-tbody');
    if (!tbody) return;

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
                <td><strong>${l.nome}</strong> ${isBirthdayToday(l.nascimento) ? '(Aniversariante)' : ''}<br><small style="color:#888;">${l.empresa || '-'}</small></td>
                <td>${l.telefone}<br><small style="color:#888;">${l.email || '-'}</small></td>
                <td>${l.origem || 'Geral'}</td>
                <td><span style="background:${stageObj.color}22; color:${stageObj.color}; padding:4px 8px; border-radius:4px;">${stageObj.label}</span></td>
                <td>${formatCurrency(l.custo)}</td>
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

// ── DRAG AND DROP KANBAN ────────────────────────────────────────────

function allowDrop(event) {
    event.preventDefault();
}

function drag(event, id) {
    event.dataTransfer.setData("text", id);
}

function drop(event, stageId) {
    event.preventDefault();
    const id = event.dataTransfer.getData("text");
    leads = leads.map(l => l.id === id ? { ...l, estagio: stageId } : l);
    persistData();
    renderKanban();
    showToast("Estágio atualizado.");
}

// ── CONTROLE DE MODAIS E TIMELINE ────────────────────────────────────

function openLeadModal() {
    document.getElementById('modal-title').innerText = "Novo Lead";
    document.getElementById('f-lead-id').value = "";
    document.getElementById('form-lead').reset();
    document.getElementById('modal-overlay').classList.add('open');
}

function closeLeadModal(event) {
    if (!event || event.target.id === 'modal-overlay' || event.target.className === 'modal-close' || event.target.className === 'btn-secondary') {
        document.getElementById('modal-overlay').classList.remove('open');
    }
}

function openDetailModal(id) {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;

    const body = document.getElementById('detail-body');
    const stageObj = STAGES.find(s => s.id === lead.estagio) || STAGES[0];
    const historico = lead.historicoNotas || [];

    document.getElementById('detail-title').innerText = lead.nome;
    body.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px; font-size:0.9rem;">
            <div><strong>E-mail:</strong> ${lead.email || '-'}</div>
            <div><strong>Telefone:</strong> ${lead.telefone || '-'}</div>
            <div><strong>Empresa:</strong> ${lead.empresa || '-'}</div>
            <div><strong>Estágio:</strong> ${stageObj.label}</div>
            <div><strong>Valor Oportunidade:</strong> ${formatCurrency(lead.custo)}</div>
            <div><strong>Nascimento:</strong> ${lead.nascimento ? formatDate(lead.nascimento) : '-'}</div>
        </div>

        <div style="margin-bottom:15px;">
            <strong>Principal Dor / Necessidade:</strong>
            <p style="margin-top:4px; color:#ccc; font-size:0.9rem;">${lead.dor || 'Não informada.'}</p>
        </div>

        <hr style="border: 0; border-top: 1px solid #2a2d3d; margin: 15px 0;">

        <!-- ÁREA DE REGISTRO DE NOTA NA TIMELINE -->
        <div style="margin-bottom:20px;">
            <label style="font-weight:bold; font-size:0.9rem; display:block; margin-bottom:6px;">Adicionar Nota ao Histórico</label>
            <div style="display:flex; gap:8px;">
                <input type="text" id="input-nova-nota" placeholder="Ex: Cliente pediu reunião na quinta-feira..." style="flex:1; padding:8px 12px; background:#12141d; border:1px solid #2a2d3d; color:#fff; border-radius:6px;">
                <button class="btn-primary" onclick="adicionarNotaTimeline('${lead.id}')">Registrar</button>
            </div>
        </div>

        <!-- TIMELINE DE INTERAÇÕES -->
        <div>
            <strong style="font-size:0.95rem; display:block; margin-bottom:12px;">Histórico de Interações (Timeline)</strong>
            ${historico.length === 0 ? '<p style="color:#777; font-size:0.85rem;">Nenhuma nota registrada até o momento.</p>' : `
                <div class="timeline-container" style="border-left: 2px solid #2a2d3d; padding-left: 15px; margin-left: 5px;">
                    ${historico.map(nota => {
                        const dataFormatada = new Date(nota.dataHora).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                        return `
                            <div class="timeline-item" style="position:relative; margin-bottom: 15px;">
                                <div style="position:absolute; left:-21px; top:3px; width:10px; height:10px; border-radius:50%; background:#4c8ce8;"></div>
                                <div style="font-size:0.75rem; color:#888;">${dataFormatada}</div>
                                <div style="font-size:0.9rem; color:#eee; margin-top:2px; background:#12141d; padding:8px 12px; border-radius:6px; border:1px solid #2a2d3d;">
                                    ${nota.texto}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    document.getElementById('detail-edit-btn').onclick = () => editLead(lead.id);
    document.getElementById('detail-overlay').classList.add('open');
}

function closeDetailModal(event) {
    if (!event || event.target.id === 'detail-overlay' || event.target.className === 'modal-close' || event.target.className === 'btn-secondary') {
        document.getElementById('detail-overlay').classList.remove('open');
    }
}

// ── UTILITÁRIOS E PERSISTÊNCIA ──────────────────────────────────────

function persistData() {
    localStorage.setItem('arq_crm_leads', JSON.stringify(leads));
    updateFollowupBadge();
}

function updateFollowupBadge() {
    const todayStr = new Date().toISOString().split('T')[0];
    const count = leads.filter(l => l.retorno && l.retorno <= todayStr && l.estagio !== 'fechado' && l.estagio !== 'perdido').length;
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
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
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
                <td><strong>${l.nome}</strong><br><small style="color:#888;">${l.empresa || '-'}</small></td>
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