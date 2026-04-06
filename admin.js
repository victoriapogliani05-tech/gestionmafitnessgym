// ============================================================
// admin.js — Admin panel logic for M.A. Fitness (Supabase)
// ============================================================

const ROWS_PER_PAGE = 15;
const ROUTINE_ROWS = 10;
const ROUTINE_DAYS = 6;
const ROUTINE_FIELDS = ['Ejercicio', 'Series', 'Rep', 'Peso'];
let currentPage = 1;
let filteredMembers = [];

async function initAdminApp() {
    console.log('[admin.js] Initializing admin app...');
    try {
        await initAdminAuth();
        console.log('[admin.js] Auth process completed.');
    } catch (err) {
        console.error('[admin.js] Error during initialization:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
    initAdminApp();
}

// ── Admin Authentication ──────────────────────────────────────
// Lista de correos con acceso administrativo (Hardcoded for extra security)
const ALLOWED_ADMINS = ['victoriapogliani05@gmail.com', 'marianelaastrada8@gmail.com'];

function isAuthorized(email) {
    if (!email) return false;
    return ALLOWED_ADMINS.includes(email.toLowerCase().trim());
}

async function initAdminAuth() {
    const overlay = document.getElementById('admin-login-overlay');
    const app = document.getElementById('admin-app');
    const emailInput = document.getElementById('admin-email');
    const passwordInput = document.getElementById('admin-password');
    const loginBtn = document.getElementById('btn-admin-login');
    const errorEl = document.getElementById('admin-login-error');

    console.log('[admin.js] Checking existing session...');

    // Check if already authenticated in this session via Supabase
    const { data: { session } } = await window.supabaseApp.auth.getSession();
    
    if (session) {
        const userEmail = session.user.email;
        console.log('[admin.js] Session found for:', userEmail);
        
        if (!isAuthorized(userEmail)) {
            console.warn('[admin.js] Unauthorized access attempt by student:', userEmail);
            errorEl.textContent = 'Acceso denegado: esta cuenta no es de administrador.';
            await window.supabaseApp.auth.signOut();
            // Force interface state
            app.style.display = 'none';
            overlay.style.display = 'flex';
        } else {
            console.log('[admin.js] Authorized admin session recovered.');
            overlay.style.display = 'none';
            app.style.display = '';
            initApp();
            return;
        }
    }

    async function attemptLogin() {
        const email = emailInput.value.trim();
        const pw = passwordInput.value.trim();
        
        if (!email || !pw) {
            errorEl.textContent = 'Ingrese correo y contraseña.';
            return;
        }

        // Pre-check email before even calling Supabase (optional, but good for UX)
        if (!isAuthorized(email)) {
            errorEl.textContent = 'Acceso denegado: este correo no tiene permisos de administrador.';
            errorEl.classList.add('shake');
            setTimeout(() => errorEl.classList.remove('shake'), 500);
            return;
        }

        loginBtn.disabled = true;
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';

        const { data, error } = await window.supabaseApp.auth.signInWithPassword({
            email: email,
            password: pw
        });

        if (error) {
            errorEl.textContent = 'Credenciales incorrectas.';
            errorEl.classList.add('shake');
            setTimeout(() => errorEl.classList.remove('shake'), 500);
            passwordInput.value = '';
            passwordInput.focus();
            loginBtn.disabled = false;
            loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
        } else {
            // Post-login double check
            if (!isAuthorized(data.user.email)) {
                console.error('[admin.js] Post-login auth mismatch for:', data.user.email);
                errorEl.textContent = 'Usuario no autorizado.';
                await window.supabaseApp.auth.signOut();
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
                return;
            }

            console.log('[admin.js] Admin login successful.');
            overlay.style.display = 'none';
            app.style.display = '';
            initApp();
        }
    }

    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') attemptLogin();
    });
    emailInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') passwordInput.focus();
    });

    // Handle auth state changes globally for logout
    window.supabaseApp.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            console.log('[admin.js] Global SIGNED_OUT detected.');
            app.style.display = 'none';
            overlay.style.display = 'flex';
            passwordInput.value = '';
            errorEl.textContent = '';
            if(loginBtn) {
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
            }
        }
    });
}

async function initApp() {
    // Safety check: before doing anything, verify email again
    const { data: { session } } = await window.supabaseApp.auth.getSession();
    if (!session || !isAuthorized(session.user.email)) {
        console.error('[admin.js] Access denied during initApp. Redirecting...');
        await window.supabaseApp.auth.signOut();
        return;
    }

    initNav();
    refreshAll();
    bindEvents();
}

// ── Navigation ────────────────────────────────────────────────
function initNav() {
    const btns = document.querySelectorAll('.nav-btn[data-target]');
    const views = document.querySelectorAll('.view-section');
    const titles = {
        dashboard: { t: 'Dashboard', s: 'Resumen general del gimnasio.' },
        members: { t: 'Gestión de Socios', s: 'Administra socios, cuotas y rutinas.' },
        routines: { t: 'Biblioteca de Rutinas', s: 'Rutinas predefinidas disponibles para asignar.' },
        'reviews-admin': { t: 'Reseñas Públicas', s: 'Modera las reseñas dejadas por los alumnos.' },
        'plans-config': { t: 'Configuración de Planes', s: 'Ajustá los precios generales de los planes.' },
    };

    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            views.forEach(v => v.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.target;
            document.getElementById(target).classList.add('active');
            document.getElementById('page-title').textContent = titles[target].t;
            document.getElementById('page-subtitle').textContent = titles[target].s;
        });
    });
}

// ── Refresh Everything ────────────────────────────────────────
async function refreshAll() {
    const members = await loadMembers();
    renderDashboard(members);
    await applyFiltersAndRender();
    await renderRoutinesLibrary();
    await loadAdminReviews();
    await loadPlansConfig();
}

// ── Dashboard ─────────────────────────────────────────────────
function renderDashboard(members) {
    const total = members.length;
    const paid = members.filter(m => isPaidThisMonth(m)).length;
    const unpaid = total - paid;

    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-active').textContent = paid;
    document.getElementById('stat-overdue').textContent = unpaid;

    const recent = [...members].sort((a, b) => {
        const dateA = a.registeredAt ? new Date(a.registeredAt) : new Date(0);
        const dateB = b.registeredAt ? new Date(b.registeredAt) : new Date(0);
        return dateB - dateA;
    }).slice(0, 6);

    const recentList = document.getElementById('dash-recent');
    const emptyMsg = document.getElementById('dash-empty');

    if (recent.length === 0) {
        recentList.innerHTML = '';
        emptyMsg.style.display = 'block';
    } else {
        emptyMsg.style.display = 'none';
        recentList.innerHTML = recent.map(m => {
            const pd = isPaidThisMonth(m);
            return `
            <li class="expiration-item">
                <div class="expiration-user">
                    <div class="avatar">${getInitials(m.name)}</div>
                    <div class="user-details">
                        <h4>${m.name}</h4>
                        <p>${getPlanDisplayName(m)} · ${getFeeDisplay(m)}</p>
                    </div>
                </div>
                <span class="badge ${pd ? 'success' : 'danger'}">${pd ? 'Pagado' : 'No pagado'}</span>
            </li>`;
        }).join('');
    }

    const planCounts = {};
    members.forEach(m => {
        const planLabel = getPlanDisplayName(m);
        planCounts[planLabel] = (planCounts[planLabel] || 0) + 1;
    });

    const dashPlans = document.getElementById('dash-plans');
    if (Object.keys(planCounts).length === 0) {
        dashPlans.innerHTML = '<p class="text-muted" style="text-align:center;padding:20px;">Sin datos.</p>';
    } else {
        dashPlans.innerHTML = Object.entries(planCounts).map(([name, count]) => {
            const pct = total > 0 ? Math.round(count / total * 100) : 0;
            return `
            <div class="plan-bar-item">
                <div class="plan-bar-label"><span>${name}</span><span>${count} (${pct}%)</span></div>
                <div class="plan-bar-bg"><div class="plan-bar-fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    }
}

// ── Members Table ─────────────────────────────────────────────
async function applyFiltersAndRender() {
    const members = await loadMembers();
    const search = document.getElementById('search-member').value.toLowerCase().trim();
    const planFilter = document.getElementById('filter-plan').value;
    const statusFilter = document.getElementById('filter-status').value;

    filteredMembers = members.filter(m => {
        const matchSearch = !search || m.name.toLowerCase().includes(search) || m.dni.includes(search);
        const matchPlan = !planFilter || m.plan === planFilter;
        let matchStatus = true;
        if (statusFilter === 'paid') matchStatus = isPaidThisMonth(m);
        else if (statusFilter === 'unpaid') matchStatus = !isPaidThisMonth(m);
        return matchSearch && matchPlan && matchStatus;
    });

    currentPage = 1;
    renderMembersPage();
}

function hasRoutineData(member) {
    if (!member.routine || !Array.isArray(member.routine)) return false;
    return member.routine.some(row =>
        row.some(day => day.ejercicio || day.series || day.rep || day.peso)
    );
}

function renderMembersPage() {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    const pageMembers = filteredMembers.slice(start, start + ROWS_PER_PAGE);
    const tbody = document.getElementById('members-tbody');
    const emptyMsg = document.getElementById('members-empty');
    const tableContainer = document.querySelector('.table-container');

    if (filteredMembers.length === 0) {
        tbody.innerHTML = '';
        if (tableContainer) tableContainer.style.display = 'none';
        emptyMsg.style.display = 'block';
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    if (tableContainer) tableContainer.style.display = 'block';
    emptyMsg.style.display = 'none';

    tbody.innerHTML = pageMembers.map(m => {
        const pd = isPaidThisMonth(m);
        const hasRt = hasRoutineData(m);
        return `
        <tr>
            <td>
                <div class="table-user">
                    <div class="avatar sm">${getInitials(m.name)}</div>
                    <span>${m.name}</span>
                </div>
            </td>
            <td class="mono">${m.dni}</td>
            <td class="mono">${m.phone || '—'}</td>
            <td>${getPlanDisplayName(m)}</td>
            <td>${getFeeDisplay(m)}</td>
            <td>
                <button class="pay-toggle ${pd ? 'paid' : 'unpaid'}" onclick="handleTogglePayment(${m.id})">
                    <i class="fas ${pd ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                    ${pd ? 'Pagado (' + getMonthName() + ')' : 'Marcar ' + getMonthName()}
                </button>
            </td>
            <td>${hasRt ? '<span class="routine-tag"><i class="fas fa-check"></i> Asignada</span>' : '<span class="text-muted">—</span>'}</td>
            <td>
                <div style="display:flex;gap:4px;">
                    <button class="icon-btn edit" title="Editar datos" onclick="openEditModal(${m.id})"><i class="fas fa-edit"></i></button>
                    <button class="icon-btn routine-btn" title="Editar rutina" onclick="openRoutineEditor(${m.id})"><i class="fas fa-dumbbell"></i></button>
                    <button class="icon-btn delete" title="Eliminar" onclick="confirmDelete(${m.id}, '${m.name.replace(/'/g, "\\'")}')""><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    renderPagination();
}

async function handleTogglePayment(memberId) {
    await togglePayment(memberId);
    await refreshAll();
}

async function confirmDelete(id, name) {
    if (confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) {
        await deleteMember(id);
        await refreshAll();
    }
}

function renderPagination() {
    const totalPages = Math.ceil(filteredMembers.length / ROWS_PER_PAGE);
    if (totalPages <= 1) {
        document.getElementById('pagination').innerHTML = `<span class="page-info">${filteredMembers.length} socio${filteredMembers.length !== 1 ? 's' : ''}</span>`;
        return;
    }
    let html = '';
    html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})"><i class="fas fa-chevron-left"></i></button>`;
    let startP = Math.max(1, currentPage - 3);
    let endP = Math.min(totalPages, startP + 6);
    startP = Math.max(1, endP - 6);
    for (let i = startP; i <= endP; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})"><i class="fas fa-chevron-right"></i></button>`;
    html += `<span class="page-info">${filteredMembers.length} socios</span>`;
    document.getElementById('pagination').innerHTML = html;
}

function goToPage(page) {
    currentPage = page;
    renderMembersPage();
}

// ── Edit Modal (data only, no routine) ────────────────────────
async function openEditModal(memberId) {
    const members = await loadMembers();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('edit-id').value = member.id;
    document.getElementById('edit-name').value = member.name;
    document.getElementById('edit-dni').value = member.dni;
    document.getElementById('edit-phone').value = member.phone || '';
    document.getElementById('edit-plan').value = member.plan;
    document.getElementById('edit-days').value = member.daysPerWeek || '2';
    document.getElementById('edit-pathology').value = member.pathologies || '';

    if (member.plan === 'estandar') {
        const opt = PLANS.estandar.options.find(o => String(o.days) === String(member.daysPerWeek));
        document.getElementById('edit-fee').value = member.fee || (opt ? opt.fee : '');
    } else {
        document.getElementById('edit-fee').value = member.fee || '';
    }

    document.getElementById('modal-title').textContent = `Editar — ${member.name}`;
    document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
}

async function saveModal() {
    const id = parseInt(document.getElementById('edit-id').value);
    const members = await loadMembers();
    const member = members.find(m => m.id === id);
    if (!member) return;

    member.name = document.getElementById('edit-name').value.trim() || member.name;
    member.phone = document.getElementById('edit-phone').value.trim();
    member.plan = document.getElementById('edit-plan').value;
    member.daysPerWeek = document.getElementById('edit-days').value;
    member.pathologies = document.getElementById('edit-pathology').value.trim();

    if (member.plan === 'estandar') {
        const opt = PLANS.estandar.options.find(o => String(o.days) === String(member.daysPerWeek));
        const customFee = parseInt(document.getElementById('edit-fee').value);
        member.fee = customFee || (opt ? opt.fee : 0);
    } else {
        member.fee = parseInt(document.getElementById('edit-fee').value) || 0;
    }

    await updateMember(member);
    closeModal();
    await refreshAll();
}

// ── Full-Screen Routine Editor ────────────────────────────────
async function openRoutineEditor(memberId) {
    const members = await loadMembers();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    document.getElementById('routine-member-id').value = member.id;
    document.getElementById('routine-member-name').textContent = member.name;

    // Build table header: 2 rows (day names + sub-columns)
    let theadHtml = '<tr class="routine-day-header">';
    for (let d = 0; d < ROUTINE_DAYS; d++) {
        theadHtml += `<th colspan="4">Día ${d + 1}</th>`;
    }
    theadHtml += '</tr><tr class="routine-sub-header">';
    for (let d = 0; d < ROUTINE_DAYS; d++) {
        ROUTINE_FIELDS.forEach(f => {
            theadHtml += `<th>${f}</th>`;
        });
    }
    theadHtml += '</tr>';
    document.getElementById('routine-edit-thead').innerHTML = theadHtml;

    // Build table body
    const routine = member.routine || [];
    let tbodyHtml = '';
    for (let r = 0; r < ROUTINE_ROWS; r++) {
        const row = routine[r] || [];
        tbodyHtml += '<tr>';
        for (let d = 0; d < ROUTINE_DAYS; d++) {
            const day = row[d] || {};
            const ej = (day.ejercicio || '').replace(/"/g, '&quot;');
            const se = (day.series || '').replace(/"/g, '&quot;');
            const re = (day.rep || '').replace(/"/g, '&quot;');
            const pe = (day.peso || '').replace(/"/g, '&quot;');
            tbodyHtml += `<td><input type="text" class="rc" data-r="${r}" data-d="${d}" data-f="ejercicio" value="${ej}" placeholder="—"></td>`;
            tbodyHtml += `<td><input type="text" class="rc rc-sm" data-r="${r}" data-d="${d}" data-f="series" value="${se}" placeholder="—"></td>`;
            tbodyHtml += `<td><input type="text" class="rc rc-sm" data-r="${r}" data-d="${d}" data-f="rep" value="${re}" placeholder="—"></td>`;
            tbodyHtml += `<td><input type="text" class="rc rc-sm" data-r="${r}" data-d="${d}" data-f="peso" value="${pe}" placeholder="—"></td>`;
        }
        tbodyHtml += '</tr>';
    }
    document.getElementById('routine-edit-tbody').innerHTML = tbodyHtml;

    document.getElementById('routine-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeRoutineEditor() {
    document.getElementById('routine-overlay').classList.remove('open');
    document.body.style.overflow = '';
}

async function saveRoutine() {
    const id = parseInt(document.getElementById('routine-member-id').value);
    const members = await loadMembers();
    const member = members.find(m => m.id === id);
    if (!member) return;

    const routine = [];
    for (let r = 0; r < ROUTINE_ROWS; r++) {
        const row = [];
        for (let d = 0; d < ROUTINE_DAYS; d++) {
            const getVal = f => {
                const el = document.querySelector(`.rc[data-r="${r}"][data-d="${d}"][data-f="${f}"]`);
                return el ? el.value.trim() : '';
            };
            row.push({
                ejercicio: getVal('ejercicio'),
                series: getVal('series'),
                rep: getVal('rep'),
                peso: getVal('peso')
            });
        }
        routine.push(row);
    }

    member.routine = routine;
    await updateMember(member);
    closeRoutineEditor();
    await refreshAll();
}

// ── Reviews Admin ─────────────────────────────────────────────
async function loadAdminReviews() {
    const tbody = document.getElementById('reviews-admin-tbody');
    const emptyMsg = document.getElementById('reviews-empty');
    if (!tbody || !emptyMsg) return;

    const reviews = await loadReviews(); // from data.js
    
    if (!reviews || reviews.length === 0) {
        tbody.innerHTML = '';
        emptyMsg.style.display = 'block';
        return;
    }
    
    emptyMsg.style.display = 'none';
    
    tbody.innerHTML = reviews.map(r => {
        const dateStr = new Date(r.created_at).toLocaleDateString('es-AR', { 
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
        
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="fa${i <= r.rating ? 's' : 'r'} fa-star" style="color:#FFD700;font-size:0.8rem"></i>`;
        }

        const safeText = r.text.replace(/"/g, '&quot;').replace(/'/g, "\\'");

        return `
        <tr>
            <td style="white-space:nowrap">${dateStr}</td>
            <td style="font-weight:600">${r.author}</td>
            <td style="white-space:nowrap">${starsHtml}</td>
            <td style="min-width:300px; padding: 12px 10px; line-height: 1.5;">
                ${r.text}
            </td>
            <td>
                <button class="icon-btn delete" title="Eliminar reseña" onclick="confirmDeleteReview(${r.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

async function confirmDeleteReview(id) {
    if (confirm('¿Seguro que querés eliminar esta reseña permanentemente?')) {
        await deleteReview(id); // from data.js
        await loadAdminReviews();
    }
}

// ── Routines Library ──────────────────────────────────────────
async function renderRoutinesLibrary() {
    const grid = document.getElementById('routines-grid');
    if (!grid) return;

    const routines = await loadLibraryRoutines(); 

    const images = [
        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?q=80&w=600&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?q=80&w=600&auto=format&fit=crop',
    ];

    if (routines.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px;">
                <p class="text-muted">No hay rutinas en la biblioteca. ¡Crea la primera!</p>
            </div>`;
        return;
    }

    grid.innerHTML = routines.map((r, i) => `
        <div class="routine-card">
            <div class="routine-img" style="background-image:url('${images[i % images.length]}')">
                <span class="routine-level">${r.level}</span>
                <button class="icon-btn delete lib-delete-btn" title="Eliminar de la biblioteca" onclick="handleDeleteLibRoutine(${r.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="routine-body">
                <h3>${r.name}</h3>
                <p class="text-muted">${r.days}</p>
                <div class="routine-exercises">
                    ${r.exercises.map(e => `
                        <div class="exercise-row">
                            <span>${e.name}</span>
                            <span class="text-muted">${e.sets}×${e.reps}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `).join('');
}

async function handleDeleteLibRoutine(id) {
    if (confirm('¿Seguro que querés eliminar esta rutina de la biblioteca?')) {
        await deleteLibraryRoutine(id);
        await renderRoutinesLibrary();
    }
}

// ── Events ────────────────────────────────────────────────────
function bindEvents() {
    document.getElementById('search-member').addEventListener('input', () => applyFiltersAndRender());
    document.getElementById('filter-plan').addEventListener('change', () => applyFiltersAndRender());
    document.getElementById('filter-status').addEventListener('change', () => applyFiltersAndRender());
    document.getElementById('btn-export-members')?.addEventListener('click', () => exportMembersToExcel());
    document.getElementById('btn-import-members')?.addEventListener('click', () => document.getElementById('import-excel-file').click());
    document.getElementById('import-excel-file')?.addEventListener('change', e => {
        if (e.target.files.length > 0) importMembersFromExcel(e.target.files[0]);
    });

    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', saveModal);
    document.getElementById('modal-overlay').addEventListener('click', e => {
        if (e.target === e.currentTarget) closeModal();
    });

    // Library Routine Creation
    document.getElementById('btn-open-create-routine')?.addEventListener('click', openLibRoutineModal);
    document.getElementById('lib-routine-close')?.addEventListener('click', closeLibRoutineModal);
    document.getElementById('lib-routine-cancel')?.addEventListener('click', closeLibRoutineModal);
    document.getElementById('lib-routine-save')?.addEventListener('click', saveLibraryRoutineAction);
    document.getElementById('btn-lib-add-exercise')?.addEventListener('click', () => addLibExerciseRow());

    // Auto-set fee when plan changes
    document.getElementById('edit-plan').addEventListener('change', e => {
        if (e.target.value === 'estandar') {
            const daysVal = document.getElementById('edit-days').value;
            const opt = PLANS.estandar.options.find(o => String(o.days) === daysVal);
            if (opt) document.getElementById('edit-fee').value = opt.fee;
        } else {
            document.getElementById('edit-fee').value = '';
        }
    });

    // Auto-set fee when days change (for estandar)
    document.getElementById('edit-days').addEventListener('change', e => {
        if (document.getElementById('edit-plan').value === 'estandar') {
            const opt = PLANS.estandar.options.find(o => String(o.days) === e.target.value);
            if (opt) document.getElementById('edit-fee').value = opt.fee;
        }
    });

    // Routine editor
    document.getElementById('btn-save-routine').addEventListener('click', saveRoutine);
    document.getElementById('btn-close-routine').addEventListener('click', closeRoutineEditor);

    document.getElementById('btn-reset-db').addEventListener('click', async () => {
        const confirmText = prompt('¿Borrar TODOS los socios? Esta acción no se puede deshacer.\n\nPara confirmar, escribe "BORRAR" debajo:');
        if (confirmText === 'BORRAR') {
            await resetDatabase();
            await refreshAll();
            alert('Base de datos de socios reiniciada.');
        } else if (confirmText !== null) {
            alert('Acción cancelada. La palabra de confirmación no coincide.');
        }
    });

    document.getElementById('btn-save-plans').addEventListener('click', handleSavePlans);

    // Admin logout
    document.getElementById('btn-admin-logout').addEventListener('click', async () => {
        await window.supabaseApp.auth.signOut();
    });

    // Sidebar Toggle (Mobile)
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            if (sidebar) sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        });
    }
    
    // Close sidebar when clicking a nav button on mobile
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.innerWidth <= 850) {
                if (sidebar) sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
}

/**
 * Imports members and their routines from an Excel file exported by this system.
 */
async function importMembersFromExcel(file) {
    console.log('[admin.js] Starting Excel Import...');
    try {
        const btn = document.getElementById('btn-import-members');
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';
        }

        if (typeof XLSX === 'undefined') {
            throw new Error('La librería Excel (SheetJS) no se cargó.');
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 1. Get Main List
                const listSheet = workbook.Sheets["Lista General"];
                if (!listSheet) throw new Error('No se encontró la pestaña "Lista General" en el archivo.');
                const mainData = XLSX.utils.sheet_to_json(listSheet);
                
                let importedCount = 0;
                let errorCount = 0;

                for (const row of mainData) {
                    try {
                        const dni = String(row['DNI'] || '').trim();
                        if (!dni) continue;

                        // Check if member already exists to avoid duplicates
                        const existing = await getMemberByDni(dni);
                        if (existing) {
                            console.warn(`[admin.js] Member with DNI ${dni} already exists. Skipping.`);
                            continue;
                        }

                        // Map Plan
                        let plan = 'estandar';
                        const planStr = String(row['Plan'] || '').toLowerCase();
                        if (planStr.includes('personalizado')) plan = 'personalizado';
                        else if (planStr.includes('online')) plan = 'online';

                        // Map Days
                        let days = '2';
                        if (planStr.includes('libre')) days = 'libre';
                        else {
                            const matchDays = planStr.match(/(\d+)\s*días/);
                            if (matchDays) days = matchDays[1];
                        }

                        // Build member object
                        const member = {
                            name: row['Nombre'],
                            dni: dni,
                            phone: row['Teléfono'] === '—' ? '' : String(row['Teléfono']),
                            email: row['Email'] === '—' ? '' : String(row['Email']),
                            plan: plan,
                            daysPerWeek: days,
                            fee: parseInt(String(row['Cuota ($)'] || '0').replace(/\D/g, '')),
                            pathologies: row['Patologías/Lesiones'] === 'Ninguna' ? '' : row['Patologías/Lesiones'],
                            routine: [] 
                        };

                        // 2. Try to find individual sheet for routine
                        let memberSheet = null;
                        for (const sName of workbook.SheetNames) {
                            if (sName === "Lista General") continue;
                            const sheet = workbook.Sheets[sName];
                            const sheetDni = sheet['B3'] ? String(sheet['B3'].v).trim() : (sheet['B4'] ? String(sheet['B4'].v).trim() : '');
                            if (sheetDni === dni) {
                                memberSheet = sheet;
                                break;
                            }
                        }

                        if (memberSheet) {
                            const routine = [];
                            for (let r = 0; r < ROUTINE_ROWS; r++) {
                                const rowCells = [];
                                for (let d = 0; d < ROUTINE_DAYS; d++) {
                                    const colLetter = String.fromCharCode(66 + d); // B, C, D, E, F, G (B is Day 1)
                                    const cellRef = colLetter + (14 + r); // Routine starts at line 14
                                    const cell = memberSheet[cellRef];
                                    const val = cell ? String(cell.v) : '';
                                    
                                    if (val && val !== '—') {
                                        const lines = val.split('\n');
                                        const ejercicio = lines[0] || '';
                                        let series = '';
                                        let rep = '';
                                        let peso = '';

                                        const srMatch = val.match(/\(([^x]+)x([^)]+)\)/);
                                        if (srMatch) {
                                            series = srMatch[1];
                                            rep = srMatch[2];
                                        }
                                        const pMatch = val.match(/\[([^\]]+)\]/);
                                        if (pMatch) peso = pMatch[1];

                                        rowCells.push({ ejercicio, series, rep, peso });
                                    } else {
                                        rowCells.push({ ejercicio: '', series: '', rep: '', peso: '' });
                                    }
                                }
                                routine.push(rowCells);
                            }
                            member.routine = routine;
                        }

                        await addMember(member);
                        importedCount++;
                    } catch (err) {
                        console.error('[admin.js] Error importing row:', row, err);
                        errorCount++;
                    }
                }

                alert(`Importación completada.\n\nÉxito: ${importedCount}\nErrores/Duplicados: ${errorCount}`);
                await refreshAll();
                
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
                document.getElementById('import-excel-file').value = ''; // Reset input
            } catch (err) {
                console.error('[admin.js] Error processing Excel data:', err);
                alert('Error al procesar el archivo: ' + err.message);
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (err) {
        console.error('[admin.js] Error in importMembersFromExcel:', err);
        alert('Error: ' + err.message);
    }
}

/**
 * Exports all members to a professional Multi-Sheet Excel file.
 */
async function exportMembersToExcel() {
    console.log('[admin.js] Starting export to Multi-Sheet Excel...');
    try {
        const btn = document.getElementById('btn-export-members');
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';
        }
        
        if (typeof XLSX === 'undefined') {
            throw new Error('La librería Excel (SheetJS) no se cargó. Esto puede ser por falta de internet o un bloqueo del navegador. Intentá recargar la página.');
        }

        const members = await loadMembers();
        
        if (!members || members.length === 0) {
            alert('No hay socios para exportar.');
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
            }
            return;
        }

        const currentMonthLabel = getMonthName();
        const wb = XLSX.utils.book_new();

        // 1. Summary Sheet
        const summaryHeaders = ['Nombre', 'DNI', 'Teléfono', 'Email', 'Plan', 'Cuota ($)', `Estado (${currentMonthLabel})`, 'Patologías/Lesiones'];
        const summaryData = members.map(m => [m.name, m.dni, m.phone || '—', m.email || '—', getPlanDisplayName(m), m.fee || 0, isPaidThisMonth(m) ? 'Pagado' : 'No pagado', m.pathologies || 'Ninguna']);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryData]), "Lista General");

        // 2. Individual Sheets
        const usedNames = new Set(["Lista General"]);
        members.forEach(m => {
            let sName = m.name.substring(0, 31).replace(/[\[\]\*\?\/\\]/g, ''); 
            if (usedNames.has(sName)) sName = (m.name.substring(0, 25) + ' ' + m.id).substring(0, 31);
            usedNames.add(sName);

            const detailRows = [
                ['FICHA DEL ALUMNO', ''],
                ['Nombre:', m.name], ['DNI:', m.dni], ['Teléfono:', m.phone || '—'], ['Email:', m.email || '—'],
                ['Plan:', getPlanDisplayName(m)], ['Cuota:', `$${m.fee || 0}`],
                [`Estado (${currentMonthLabel}):`, isPaidThisMonth(m) ? 'PAGADO' : 'NO PAGADO'],
                ['Patologías:', m.pathologies || 'Ninguna'], [''], ['RUTINA DE ENTRENAMIENTO', ''], ['']
            ];

            const routineHeaders = ['EJERCICIO \\ DÍA'];
            for (let d = 0; d < ROUTINE_DAYS; d++) routineHeaders.push(`DÍA ${d + 1}`);
            detailRows.push(routineHeaders);

            for (let r = 0; r < ROUTINE_ROWS; r++) {
                const row = [`Ejercicio ${r + 1}`];
                for (let d = 0; d < ROUTINE_DAYS; d++) {
                    const ex = m.routine?.[r]?.[d];
                    if (ex && (ex.ejercicio || ex.series || ex.rep || ex.peso)) {
                        let c = ex.ejercicio || 'Ej';
                        if (ex.series || ex.rep) c += `\n(${ex.series || '?'}x${ex.rep || '?'})`;
                        if (ex.peso) c += `\n[${ex.peso}]`;
                        row.push(c);
                    } else row.push('—');
                }
                detailRows.push(row);
            }
            const ws = XLSX.utils.aoa_to_sheet(detailRows);
            ws['!cols'] = [{ wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
            XLSX.utils.book_append_sheet(wb, ws, sName);
        });

        const date = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `alumnos_ma_fitness_${date}.xlsx`);
        console.log('[admin.js] Multi-Sheet Excel Export ready.');
        
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalContent;
        }
    } catch (err) {
        console.error('[admin.js] Error exporting to Excel:', err);
        alert('Error al exportar: ' + err.message);
        const btn = document.getElementById('btn-export-members');
        if (btn) {
            btn.disabled = false; 
            btn.innerHTML = '<i class="fas fa-file-excel"></i> Exportar a Excel';
        }
    }
}

// ── Plan Configuration Logic ──────────────────────────────────
async function loadPlansConfig() {
    const p = PLANS.estandar.options;
    document.getElementById('plan-fee-2').value = p.find(o => o.days === 2)?.fee || '';
    document.getElementById('plan-fee-3').value = p.find(o => o.days === 3)?.fee || '';
    document.getElementById('plan-fee-4').value = p.find(o => o.days === 4)?.fee || '';
    document.getElementById('plan-fee-5').value = p.find(o => o.days === 5)?.fee || '';
    document.getElementById('plan-fee-libre').value = p.find(o => o.days === 'libre')?.fee || '';
}

async function handleSavePlans() {
    const msg = document.getElementById('plans-config-msg');
    msg.textContent = 'Guardando y actualizando socios...';
    msg.style.color = 'var(--text-secondary)';

    const newFees = {
        '2': parseInt(document.getElementById('plan-fee-2').value),
        '3': parseInt(document.getElementById('plan-fee-3').value),
        '4': parseInt(document.getElementById('plan-fee-4').value),
        '5': parseInt(document.getElementById('plan-fee-5').value),
        'libre': parseInt(document.getElementById('plan-fee-libre').value)
    };

    try {
        for (const [days, fee] of Object.entries(newFees)) {
            if (isNaN(fee)) continue;
            
            // 1. Update local PLANS object (volatile but useful for current session)
            const opt = PLANS.estandar.options.find(o => String(o.days) === String(days));
            if (opt) {
                opt.fee = fee;
                opt.label = `${days === 'libre' ? 'Pase Libre' : days + ' días'} — $${fee.toLocaleString('es-AR')}`;
            }

            // 2. Update all members in Supabase
            await bulkUpdatePlanFees('estandar', days, fee);
        }
        
        msg.textContent = '¡Precios actualizados y socios notificados con el nuevo valor!';
        msg.style.color = 'var(--success)';
        setTimeout(() => msg.textContent = '', 5000);
        await refreshAll();
    } catch (err) {
        console.error('Error saving plans:', err);
        msg.textContent = 'Error al guardar: ' + err.message;
        msg.style.color = 'var(--danger)';
    }
}

// ── Library Routine Modal Logic ───────────────────────────────
function openLibRoutineModal() {
    const overlay = document.getElementById('lib-routine-overlay');
    if (!overlay) return;
    
    // Clear inputs
    document.getElementById('lib-routine-name').value = '';
    document.getElementById('lib-routine-level').value = 'Intermedio';
    document.getElementById('lib-routine-days').value = '';
    document.getElementById('lib-routine-exercises-list').innerHTML = '';
    
    // Add 3 empty rows by default
    for (let i = 0; i < 3; i++) addLibExerciseRow();
    
    overlay.classList.add('open');
}

function closeLibRoutineModal() {
    document.getElementById('lib-routine-overlay').classList.remove('open');
}

function addLibExerciseRow(name = '', sets = '', reps = '') {
    const list = document.getElementById('lib-routine-exercises-list');
    const row = document.createElement('div');
    row.className = 'lib-exercise-row';
    row.innerHTML = `
        <input type="text" placeholder="Ejercicio" class="lib-ex-name" value="${name}">
        <input type="text" placeholder="Series" class="lib-ex-sets" value="${sets}" style="width:60px;">
        <input type="text" placeholder="Reps" class="lib-ex-reps" value="${reps}" style="width:60px;">
        <button class="icon-btn delete sm" onclick="this.parentElement.remove()" title="Eliminar"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(row);
}

async function saveLibraryRoutineAction() {
    const name = document.getElementById('lib-routine-name').value.trim();
    const level = document.getElementById('lib-routine-level').value;
    const days = document.getElementById('lib-routine-days').value.trim();
    
    if (!name || !days) {
        alert('Por favor completa el nombre y los días de la rutina.');
        return;
    }
    
    const exercises = [];
    document.querySelectorAll('.lib-exercise-row').forEach(row => {
        const exName = row.querySelector('.lib-ex-name').value.trim();
        const exSets = row.querySelector('.lib-ex-sets').value.trim();
        const exReps = row.querySelector('.lib-ex-reps').value.trim();
        
        if (exName) {
            exercises.push({ name: exName, sets: exSets, reps: exReps });
        }
    });
    
    if (exercises.length === 0) {
        alert('Agrega al menos un ejercicio a la rutina.');
        return;
    }
    
    const btn = document.getElementById('lib-routine-save');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    
    try {
        await addLibraryRoutine({ name, level, days, exercises });
        closeLibRoutineModal();
        await renderRoutinesLibrary();
    } catch (err) {
        alert('Error al guardar la rutina: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

