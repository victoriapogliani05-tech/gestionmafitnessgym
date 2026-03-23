// ============================================================
// data.js — Shared data layer for M.A. Fitness Gym Management
// Uses Supabase to persist data in the cloud.
// ============================================================

// ── Plan Definitions ──────────────────────────────────────────
const PLANS = {
    estandar: {
        id: 'estandar',
        name: 'Estándar',
        options: [
            { days: 2, fee: 32000, label: '2 días — $32.000' },
            { days: 3, fee: 36000, label: '3 días — $36.000' },
            { days: 4, fee: 40000, label: '4 días — $40.000' },
            { days: 5, fee: 45000, label: '5 días — $45.000' },
            { days: 'libre', fee: 48000, label: 'Pase Libre — $48.000' },
        ]
    },
    personalizado: {
        id: 'personalizado',
        name: 'Personalizado',
        options: [] // Fee set by admin
    },
    online: {
        id: 'online',
        name: 'Online',
        options: [] // Fee set by admin
    }
};

// ── Routines Library ──────────────────────────────────────────
const ROUTINES_LIBRARY = [
    {
        id: 'r1',
        name: 'Hipertrofia Tren Superior',
        level: 'Intermedio',
        days: 'Lunes / Miércoles / Viernes',
        exercises: [
            { name: 'Press de banca plano', sets: 4, reps: '10-12' },
            { name: 'Remo con barra', sets: 4, reps: '10-12' },
            { name: 'Press militar', sets: 3, reps: '10' },
            { name: 'Curl de bíceps', sets: 3, reps: '12' },
            { name: 'Tríceps en polea', sets: 3, reps: '12' },
            { name: 'Elevaciones laterales', sets: 3, reps: '15' },
        ]
    },
    {
        id: 'r2',
        name: 'Hipertrofia Tren Inferior',
        level: 'Intermedio',
        days: 'Martes / Jueves / Sábado',
        exercises: [
            { name: 'Sentadilla con barra', sets: 4, reps: '8-10' },
            { name: 'Prensa de piernas', sets: 4, reps: '12' },
            { name: 'Peso muerto rumano', sets: 3, reps: '10' },
            { name: 'Extensión de cuádriceps', sets: 3, reps: '12' },
            { name: 'Curl femoral', sets: 3, reps: '12' },
            { name: 'Elevación de gemelos', sets: 4, reps: '15' },
        ]
    },
    {
        id: 'r3',
        name: 'Full Body Principiante',
        level: 'Principiante',
        days: 'Lunes / Miércoles / Viernes',
        exercises: [
            { name: 'Sentadilla goblet', sets: 3, reps: '12' },
            { name: 'Press de pecho con mancuernas', sets: 3, reps: '12' },
            { name: 'Remo con mancuerna', sets: 3, reps: '12' },
            { name: 'Zancadas', sets: 3, reps: '10 c/lado' },
            { name: 'Plancha abdominal', sets: 3, reps: '30s' },
            { name: 'Elongación general', sets: 1, reps: '10 min' },
        ]
    },
    {
        id: 'r4',
        name: 'Quema de Grasa HIIT',
        level: 'Avanzado',
        days: 'Martes / Jueves / Sábado',
        exercises: [
            { name: 'Burpees', sets: 4, reps: '15' },
            { name: 'Mountain climbers', sets: 4, reps: '20' },
            { name: 'Kettlebell swings', sets: 4, reps: '15' },
            { name: 'Box jumps', sets: 3, reps: '12' },
            { name: 'Battle ropes', sets: 3, reps: '30s' },
            { name: 'Sprint en cinta', sets: 5, reps: '30s / 30s descanso' },
        ]
    },
    {
        id: 'r5',
        name: 'Funcional General',
        level: 'Intermedio',
        days: 'Lunes a Viernes',
        exercises: [
            { name: 'TRX rows', sets: 3, reps: '12' },
            { name: 'Thrusters', sets: 3, reps: '10' },
            { name: 'Planchas dinámicas', sets: 3, reps: '12' },
            { name: 'Salto al cajón', sets: 3, reps: '10' },
            { name: 'Wall balls', sets: 3, reps: '15' },
            { name: 'Farmer walk', sets: 3, reps: '30m' },
        ]
    },
    {
        id: 'r6',
        name: 'Fuerza Máxima',
        level: 'Avanzado',
        days: 'Lunes / Miércoles / Viernes',
        exercises: [
            { name: 'Sentadilla trasera', sets: 5, reps: '5' },
            { name: 'Press de banca', sets: 5, reps: '5' },
            { name: 'Peso muerto convencional', sets: 5, reps: '3' },
            { name: 'Press militar estricto', sets: 4, reps: '5' },
            { name: 'Dominadas lastradas', sets: 4, reps: '5' },
            { name: 'Remo pendlay', sets: 4, reps: '5' },
        ]
    },
];

// ── Field Mapping: JS camelCase ↔ DB snake_case ───────────────
function memberToDb(member) {
    const dbRow = {};
    if (member.name !== undefined) dbRow.name = member.name;
    if (member.dni !== undefined) dbRow.dni = member.dni;
    if (member.phone !== undefined) dbRow.phone = member.phone;
    if (member.plan !== undefined) dbRow.plan = member.plan;
    if (member.daysPerWeek !== undefined) dbRow.days_per_week = member.daysPerWeek;
    if (member.fee !== undefined) dbRow.fee = member.fee;
    if (member.paidMonth !== undefined) dbRow.paid_month = member.paidMonth;
    if (member.routine !== undefined) dbRow.routine = member.routine;
    if (member.registeredAt !== undefined) dbRow.registered_at = member.registeredAt;
    if (member.pathologies !== undefined) dbRow.pathologies = member.pathologies;
    if (member.auth_id !== undefined) dbRow.auth_id = member.auth_id;
    return dbRow;
}

function dbToMember(row) {
    return {
        id: row.id,
        name: row.name,
        dni: row.dni,
        phone: row.phone,
        plan: row.plan,
        daysPerWeek: row.days_per_week,
        fee: row.fee,
        paidMonth: row.paid_month,
        routine: row.routine,
        registeredAt: row.registered_at,
        pathologies: row.pathologies || '',
        auth_id: row.auth_id,
    };
}

// ── Supabase Data Helpers (async) ─────────────────────────────
async function loadMembers() {
    const { data, error } = await window.supabaseApp
        .from('members')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error loading members:', error);
        return [];
    }
    return (data || []).map(dbToMember);
}

async function addMember(member) {
    const dbRow = memberToDb(member);
    const { data, error } = await window.supabaseApp
        .from('members')
        .insert([dbRow])
        .select()
        .single();

    if (error) {
        console.error('Error adding member:', error);
        throw error;
    }
    return dbToMember(data);
}

async function updateMember(updatedMember) {
    const dbRow = memberToDb(updatedMember);
    const { error } = await window.supabaseApp
        .from('members')
        .update(dbRow)
        .eq('id', updatedMember.id);

    if (error) {
        console.error('Error updating member:', error);
    }
}

async function deleteMember(memberId) {
    const { error } = await window.supabaseApp
        .from('members')
        .delete()
        .eq('id', memberId);

    if (error) {
        console.error('Error deleting member:', error);
    }
}

async function getMemberByDni(dni) {
    const { data, error } = await window.supabaseApp
        .from('members')
        .select('*')
        .eq('dni', dni)
        .maybeSingle();

    if (error) {
        console.error('Error finding member:', error);
        return null;
    }
    return data ? dbToMember(data) : null;
}

function getRoutineById(id) {
    return ROUTINES_LIBRARY.find(r => r.id === id) || null;
}

async function resetDatabase() {
    const { error } = await window.supabaseApp
        .from('members')
        .delete()
        .neq('id', 0); // Delete all rows

    if (error) {
        console.error('Error resetting database:', error);
    }
}

async function togglePayment(memberId) {
    const members = await loadMembers();
    const member = members.find(m => m.id === memberId);
    if (!member) return;
    const month = getCurrentMonth();
    member.paidMonth = (member.paidMonth === month) ? null : month;
    await updateMember(member);
}

// ── Supabase Reviews Helpers (async) ──────────────────────────
async function loadReviews() {
    const { data, error } = await window.supabaseApp
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading reviews:', error);
        return [];
    }
    return data || [];
}

async function addReview(review) {
    const { data, error } = await window.supabaseApp
        .from('reviews')
        .insert([{
            author: review.author || 'Anónimo',
            rating: review.rating,
            text: review.text,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        console.error('Error adding review:', error);
        return null;
    }
    return data;
}

async function deleteReview(reviewId) {
    const { error } = await window.supabaseApp
        .from('reviews')
        .delete()
        .eq('id', reviewId);

    if (error) {
        console.error('Error deleting review:', error);
    }
}

// ── Supabase Library Routines Helpers (async) ─────────────────
async function loadLibraryRoutines() {
    const { data, error } = await window.supabaseApp
        .from('routines_library')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error('Error loading library routines:', error);
        // Fallback to hardcoded library if table doesn't exist yet
        return ROUTINES_LIBRARY; 
    }
    return data || [];
}

async function addLibraryRoutine(routine) {
    const { data, error } = await window.supabaseApp
        .from('routines_library')
        .insert([{
            name: routine.name,
            level: routine.level,
            days: routine.days,
            exercises: routine.exercises,
            created_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (error) {
        console.error('Error adding library routine:', error);
        throw error;
    }
    return data;
}

async function deleteLibraryRoutine(id) {
    const { error } = await window.supabaseApp
        .from('routines_library')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting library routine:', error);
        throw error;
    }
}

// ── Formatting Helpers ────────────────────────────────────────
function formatDate(dateString) {
    if (!dateString) return '—';
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    return new Date(dateString + 'T12:00:00').toLocaleDateString('es-AR', options);
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined || amount === 0) return 'Pendiente';
    return '$' + amount.toLocaleString('es-AR');
}

// ── Payment / Month Helpers ───────────────────────────────────
function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isPaidThisMonth(member) {
    return member.paidMonth === getCurrentMonth();
}

function getMonthName(monthStr) {
    // monthStr format: "YYYY-MM"
    const [year, month] = (monthStr || getCurrentMonth()).split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('es-AR', { month: 'long' }).replace(/^\w/, c => c.toUpperCase());
}

function getDueDateDisplay() {
    // Dues always on the 10th of the current calendar month
    const now = new Date();
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);
    return formatDate(dueDate.toISOString().split('T')[0]);
}

function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getPlanDisplayName(member) {
    const plan = PLANS[member.plan];
    if (!plan) return member.plan;
    let label = plan.name;
    if (member.plan === 'estandar' && member.daysPerWeek) {
        label += member.daysPerWeek === 'libre' ? ' (Pase Libre)' : ` (${member.daysPerWeek} días)`;
    }
    return label;
}

function getFeeDisplay(member) {
    if (member.plan === 'personalizado' || member.plan === 'online') {
        if (!member.fee || member.fee === 0) {
            return 'A confirmar por la profe';
        }
    }
    return formatCurrency(member.fee);
}

// ── Bulk Updates ─────────────────────────────────────────────
async function bulkUpdatePlanFees(planId, daysPerWeek, newFee) {
    console.log(`[data.js] Bulk updating ${planId} (${daysPerWeek}) to $${newFee}`);
    const { error } = await window.supabaseApp
        .from('members')
        .update({ fee: newFee })
        .eq('plan', planId)
        .eq('days_per_week', String(daysPerWeek));

    if (error) {
        console.error('Error in bulkUpdatePlanFees:', error);
        throw error;
    }
}
