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

// ── Routines Library (Fallback — now uses same grid format as member routines) ──
// The exercises field stores the 6-day grid: routine_data[row][day] = {ejercicio, series, rep, peso}
const ROUTINES_LIBRARY = [];

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

// ── Supabase & LocalStorage Library Routines Helpers ──────────
let useLocalLibrary = false;

function createRoutineGrid(compactData) {
    const grid = [];
    for (let r = 0; r < 20; r++) {
        const row = [];
        for (let d = 0; d < 6; d++) {
            const cell = compactData[d]?.[r] || { ejercicio: '', series: '', rep: '', peso: '' };
            row.push({
                ejercicio: cell.ejercicio || '',
                series: cell.series || '',
                rep: cell.rep || '',
                peso: cell.peso || ''
            });
        }
        grid.push(row);
    }
    return grid;
}

function loadLocalLibraryRoutines() {
    const data = localStorage.getItem('gym_routines_library');
    const version = localStorage.getItem('gym_routines_library_v4');
    // If empty, has old length, or hasn't migrated to version 4 (grouped muscles, no abs), populate it
    if (!data || JSON.parse(data).length <= 2 || !version) {
        const compactRoutines = [
            // ================= HOMBRES =================
            // --- 2 Días ---
            {
                name: "H - 2 Días - Principiante",
                level: "Principiante",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Camilla de Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Camilla Femoral Acostado", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Press Pecho Mancuernas", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Elevación Lateral Manc.", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Curl de Bíceps Polea", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Tríceps Extensión Polea", series: "3", rep: "12", peso: "15kg" }
                    ],
                    1: [
                        { ejercicio: "Peso Muerto Rumano", series: "3", rep: "10", peso: "15kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Aperturas Pec Deck", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Press Hombro Mancuernas", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Curl Martillo Manc.", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Press Francés con Manc.", series: "3", rep: "12", peso: "6kg" }
                    ]
                }
            },
            {
                name: "H - 2 Días - Intermedio",
                level: "Intermedio",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Press de Banca Plano", series: "4", rep: "8", peso: "40kg" },
                        { ejercicio: "Press Inclinado Mancuernas", series: "3", rep: "10", peso: "18kg" },
                        { ejercicio: "Remo con Barra", series: "4", rep: "8", peso: "35kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "45kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Fondos en Paralelas", series: "3", rep: "10", peso: "—" },
                        { ejercicio: "Curl de Bíceps Barra", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Press Francés Tríceps", series: "3", rep: "12", peso: "20kg" }
                    ],
                    1: [
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "50kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "80kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "30kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "40kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Estocadas Caminando", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Hip Thrust con Barra", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Gemelos de Pie", series: "3", rep: "15", peso: "15kg" }
                    ]
                }
            },
            {
                name: "H - 2 Días - Avanzado",
                level: "Avanzado",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Press Plano Barra", series: "4", rep: "6", peso: "60kg" },
                        { ejercicio: "Fondos Paralelas Lastrado", series: "3", rep: "8", peso: "+10kg" },
                        { ejercicio: "Remo con Barra (RPE 9)", series: "4", rep: "6", peso: "55kg" },
                        { ejercicio: "Dominadas Lastradas", series: "3", rep: "8", peso: "+5kg" },
                        { ejercicio: "Press Militar Barra", series: "3", rep: "8", peso: "30kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Curl Bíceps Scott Barra W", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Copa Tríceps Mancuerna", series: "3", rep: "10", peso: "18kg" }
                    ],
                    1: [
                        { ejercicio: "Sentadilla Trasera (RPE 9)", series: "4", rep: "6", peso: "80kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "100kg" },
                        { ejercicio: "Peso Muerto Convencional", series: "3", rep: "5", peso: "90kg" },
                        { ejercicio: "Hip Thrust Barra", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Estocadas Búlgaras", series: "3", rep: "8", peso: "16kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "40kg" },
                        { ejercicio: "Camilla Femoral Acostado", series: "3", rep: "12", peso: "30kg" },
                        { ejercicio: "Gemelos en Prensa", series: "4", rep: "15", peso: "80kg" }
                    ]
                }
            },
            // --- 3 Días ---
            {
                name: "H - 3 Días - Principiante",
                level: "Principiante",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Camilla de Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Press Pecho Mancuernas", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Elevación Lateral", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Curl Bíceps Manc.", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Tríceps Copa", series: "3", rep: "12", peso: "6kg" }
                    ],
                    1: [
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Camilla Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "3", rep: "10", peso: "15kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Press Hombro Mancuernas", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Curl Martillo", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Tríceps Polea", series: "3", rep: "12", peso: "15kg" }
                    ],
                    2: [
                        { ejercicio: "Peso Muerto Rumano", series: "3", rep: "10", peso: "15kg" },
                        { ejercicio: "Estocadas Estáticas", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Press Pecho Inclinado Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Curl Bíceps Polea", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Fondos Banco", series: "3", rep: "12", peso: "—" }
                    ]
                }
            },
            {
                name: "H - 3 Días - Intermedio",
                level: "Intermedio",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Press de Banca Plano", series: "4", rep: "8", peso: "40kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "10", peso: "16kg" },
                        { ejercicio: "Aperturas Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Press Militar Mancuernas", series: "3", rep: "8", peso: "14kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "15", peso: "7kg" },
                        { ejercicio: "Fondos Paralelas", series: "3", rep: "10", peso: "—" },
                        { ejercicio: "Tríceps Polea Soga", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Press Francés Manc.", series: "3", rep: "12", peso: "8kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "4", rep: "10", peso: "45kg" },
                        { ejercicio: "Remo con Barra", series: "4", rep: "8", peso: "35kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "18kg" },
                        { ejercicio: "Pull Over Polea Alta", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "15", peso: "15kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Curl de Bíceps Alterno", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Curl Bíceps Barra W", series: "3", rep: "12", peso: "20kg" }
                    ],
                    2: [
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "55kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "100kg" },
                        { ejercicio: "Estocadas Caminando", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "30kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "40kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Hip Thrust Barra", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Gemelos en Prensa", series: "4", rep: "15", peso: "60kg" }
                    ]
                }
            },
            {
                name: "H - 3 Días - Avanzado",
                level: "Avanzado",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Barra", series: "5", rep: "5", peso: "75kg" },
                        { ejercicio: "Sillón Cuádriceps", series: "3", rep: "12", peso: "35kg" },
                        { ejercicio: "Press de Banca", series: "5", rep: "5", peso: "65kg" },
                        { ejercicio: "Remo con Barra", series: "5", rep: "5", peso: "50kg" },
                        { ejercicio: "Press Militar Barra", series: "3", rep: "8", peso: "35kg" },
                        { ejercicio: "Curl Bíceps Barra", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Press Francés Tríceps", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Fondos en Paralelas", series: "3", rep: "10", peso: "—" }
                    ],
                    1: [
                        { ejercicio: "Peso Muerto Convencional", series: "5", rep: "3", peso: "100kg" },
                        { ejercicio: "Camilla Femoral", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "4", rep: "8", peso: "22kg" },
                        { ejercicio: "Dominadas Lastradas", series: "4", rep: "8", peso: "+5kg" },
                        { ejercicio: "Vuelos Laterales", series: "4", rep: "12", peso: "9kg" },
                        { ejercicio: "Fondos Lastrado", series: "3", rep: "8", peso: "+10kg" },
                        { ejercicio: "Curl Martillo Manc.", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Tríceps Polea Soga", series: "3", rep: "12", peso: "15kg" }
                    ],
                    2: [
                        { ejercicio: "Prensa de Piernas", series: "4", rep: "10", peso: "120kg" },
                        { ejercicio: "Zancadas Búlgaras", series: "3", rep: "8", peso: "18kg" },
                        { ejercicio: "Hip Thrust Barra", series: "4", rep: "10", peso: "70kg" },
                        { ejercicio: "Remo en Máquina Cerrado", series: "3", rep: "10", peso: "45kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "35kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "15", peso: "8kg" },
                        { ejercicio: "Copa Tríceps", series: "3", rep: "10", peso: "16kg" },
                        { ejercicio: "Curl de Bíceps Alterno", series: "3", rep: "12", peso: "10kg" }
                    ]
                }
            },
            // --- 5 Días ---
            {
                name: "H - 5 Días - Principiante",
                level: "Principiante",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Press de Banca Plano", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Aperturas Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Cruce de Poleas", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Flexiones de Brazo", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Fondos en Paralelas", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Flexiones de Brazo Declinadas", series: "3", rep: "12", peso: "—" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Jalón al Pecho Agarre Cerrado", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo con Barra T", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Pull Over Polea", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Hiperextensiones", series: "3", rep: "15", peso: "—" },
                        { ejercicio: "Espinales", series: "3", rep: "15", peso: "—" }
                    ],
                    2: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Camilla Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Zancadas Estáticas", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Peso Muerto Rumano Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Abductores Máquina", series: "3", rep: "15", peso: "25kg" },
                        { ejercicio: "Gemelos de Pie", series: "3", rep: "15", peso: "15kg" }
                    ],
                    3: [
                        { ejercicio: "Press Militar Manc.", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Press Militar con Barra", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Remo Mentón Polea", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Elevaciones Frontales Manc.", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Encogimientos Hombro Manc.", series: "3", rep: "15", peso: "12kg" }
                    ],
                    4: [
                        { ejercicio: "Curl de Bíceps Barra", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Curl Martillo Manc.", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Curl Concentrado Manc.", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Curl Bíceps Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Tríceps Extensión Polea", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Fondos en Banco", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Extensión Polea Soga", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Tríceps Copa", series: "3", rep: "12", peso: "6kg" }
                    ]
                }
            },
            {
                name: "H - 5 Días - Intermedio",
                level: "Intermedio",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Press de Banca Plano", series: "4", rep: "8", peso: "45kg" },
                        { ejercicio: "Press Inclinado Barra", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Press Declinado Manc.", series: "3", rep: "10", peso: "16kg" },
                        { ejercicio: "Aperturas Inclinadas Manc.", series: "3", rep: "10", peso: "14kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "30kg" },
                        { ejercicio: "Cruce de Poleas", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Fondos Pecho", series: "3", rep: "10", peso: "—" },
                        { ejercicio: "Flexiones de Brazo con Lastre", series: "3", rep: "12", peso: "—" }
                    ],
                    1: [
                        { ejercicio: "Peso Muerto Convencional", series: "4", rep: "6", peso: "70kg" },
                        { ejercicio: "Remo con Barra", series: "4", rep: "8", peso: "40kg" },
                        { ejercicio: "Remo Kroc Manc.", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Jalón Pecho Cerrado", series: "3", rep: "10", peso: "45kg" },
                        { ejercicio: "Remo Polea Baja Agarre Ancho", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Jalón al Pecho Prono", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Pull Over Polea Alta", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Hiperextensiones Lastradas", series: "3", rep: "12", peso: "+5kg" }
                    ],
                    2: [
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "60kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "100kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "35kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "3", rep: "10", peso: "45kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Estocadas Caminando", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Hip Thrust con Barra", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Gemelos Sentado", series: "4", rep: "15", peso: "30kg" }
                    ],
                    3: [
                        { ejercicio: "Press Militar Barra", series: "4", rep: "8", peso: "30kg" },
                        { ejercicio: "Remo Mentón Barra W", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Elevaciones Laterales Manc.", series: "4", rep: "12", peso: "8kg" },
                        { ejercicio: "Vuelos Laterales Polea", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Elevaciones Frontales Disco", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Vuelos Posteriores Manc.", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Encogimientos de Hombros", series: "3", rep: "15", peso: "16kg" }
                    ],
                    4: [
                        { ejercicio: "Curl de Bíceps Alterno", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Curl Concentrado Manc.", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Curl Martillo Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Curl en Banco Inclinado", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Press Francés Barra W", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Extensión Polea Soga", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Fondos Paralelas", series: "3", rep: "10", peso: "—" },
                        { ejercicio: "Extensión Polea Prono", series: "3", rep: "12", peso: "15kg" }
                    ]
                }
            },
            {
                name: "H - 5 Días - Avanzado",
                level: "Avanzado",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Press Plano Barra", series: "3", rep: "5", peso: "70kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "8", peso: "24kg" },
                        { ejercicio: "Cruce de Poleas Altas", series: "3", rep: "10", peso: "15kg" },
                        { ejercicio: "Remo con Barra", series: "3", rep: "5", peso: "60kg" },
                        { ejercicio: "Dominadas Lastradas", series: "3", rep: "6", peso: "+10kg" },
                        { ejercicio: "Press Militar Barra", series: "3", rep: "6", peso: "40kg" },
                        { ejercicio: "Vuelos Laterales Polea", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "15", peso: "15kg" }
                    ],
                    1: [
                        { ejercicio: "Sentadilla Trasera Barra", series: "3", rep: "5", peso: "90kg" },
                        { ejercicio: "Prensa Inclinada", series: "3", rep: "8", peso: "150kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Peso Muerto Convencional", series: "3", rep: "5", peso: "110kg" },
                        { ejercicio: "Zancadas Caminando Last.", series: "3", rep: "10", peso: "16kg" },
                        { ejercicio: "Hip Thrust con Barra", series: "3", rep: "10", peso: "70kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "8", peso: "35kg" },
                        { ejercicio: "Gemelos Sentado", series: "3", rep: "8", peso: "40kg" }
                    ],
                    2: [
                        { ejercicio: "Remo Mancuerna Pesado", series: "4", rep: "10", peso: "24kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "45kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "55kg" },
                        { ejercicio: "Pull Over Polea Alta", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Remo al Mentón Barra", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Elevación Lateral Polea", series: "4", rep: "12", peso: "10kg" },
                        { ejercicio: "Vuelos Posteriores Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Face Pull Polea", series: "3", rep: "12", peso: "15kg" }
                    ],
                    3: [
                        { ejercicio: "Sentadilla Búlgara", series: "4", rep: "8", peso: "20kg" },
                        { ejercicio: "Prensa a una Pierna", series: "3", rep: "12", peso: "40kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "4", rep: "12", peso: "45kg" },
                        { ejercicio: "Peso Muerto Rumano Barra", series: "3", rep: "10", peso: "50kg" },
                        { ejercicio: "Camilla Femoral Acostado", series: "4", rep: "12", peso: "30kg" },
                        { ejercicio: "Hip Thrust Barra Pesado", series: "3", rep: "10", peso: "80kg" },
                        { ejercicio: "Abductor Máquina Pesado", series: "3", rep: "12", peso: "45kg" },
                        { ejercicio: "Gemelos de Pie", series: "4", rep: "15", peso: "25kg" }
                    ],
                    4: [
                        { ejercicio: "Press Inclinado Manc.", series: "4", rep: "10", peso: "22kg" },
                        { ejercicio: "Aperturas en Poleas", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Curl Bíceps Scott Barra", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Curl Martillo Polea", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Curl Inclinado Mancuerna", series: "3", rep: "10", peso: "14kg" },
                        { ejercicio: "Tríceps Copa Mancuerna", series: "3", rep: "12", peso: "18kg" },
                        { ejercicio: "Fondos Paralelas Lastrado", series: "3", rep: "10", peso: "+5kg" },
                        { ejercicio: "Extensión Polea Soga", series: "3", rep: "12", peso: "15kg" }
                    ]
                }
            },
            // ================= MUJERES =================
            // --- 2 Días ---
            {
                name: "M - 2 Días - Principiante",
                level: "Principiante",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Hip Thrust Mancuerna", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Camilla de Femorales", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Abductor en Polea", series: "3", rep: "15", peso: "7kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Elevación Lateral Manc.", series: "3", rep: "12", peso: "5kg" }
                    ],
                    1: [
                        { ejercicio: "Peso Muerto Rumano Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Estocadas Estáticas Manc.", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Camilla Femoral Acostado", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Puente de Glúteo", series: "3", rep: "15", peso: "—" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Press Hombro Mancuernas", series: "3", rep: "10", peso: "5kg" }
                    ]
                }
            },
            {
                name: "M - 2 Días - Intermedio",
                level: "Intermedio",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust con Barra", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Sentadilla Búlgara", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "25kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Patada de Glúteo Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Abductores en Polea", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "30kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Tríceps Polea Soga", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Curl de Bíceps Alterno", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Espinales", series: "3", rep: "15", peso: "—" }
                    ]
                }
            },
            {
                name: "M - 2 Días - Avanzado",
                level: "Avanzado",
                days: "2 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust Barra (Pausa 2\")", series: "4", rep: "8", peso: "50kg" },
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "40kg" },
                        { ejercicio: "Sentadilla Búlgara Déficit", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Extensión Cuádriceps", series: "3", rep: "12", peso: "30kg" },
                        { ejercicio: "Peso Muerto Sumo Barra", series: "4", rep: "8", peso: "45kg" },
                        { ejercicio: "Camilla Femoral Sentada", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Patada Glúteo Cruzada", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor Máquina Pesado", series: "3", rep: "20", peso: "45kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho Amplio", series: "4", rep: "10", peso: "40kg" },
                        { ejercicio: "Remo con Barra", series: "4", rep: "8", peso: "25kg" },
                        { ejercicio: "Dominadas Asistidas", series: "3", rep: "8", peso: "—" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "8", peso: "12kg" },
                        { ejercicio: "Elevaciones Lat. Inclinada", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "15", peso: "15kg" },
                        { ejercicio: "Tríceps Extensión Copa", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Curl de Bíceps Inclinado", series: "3", rep: "12", peso: "8kg" }
                    ]
                }
            },
            // --- 3 Días ---
            {
                name: "M - 3 Días - Principiante",
                level: "Principiante",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Hip Thrust Mancuerna", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Camilla de Cuádriceps", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Elevación Lateral", series: "3", rep: "12", peso: "4kg" },
                        { ejercicio: "Curl Bíceps Polea", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Tríceps Extensión", series: "3", rep: "12", peso: "10kg" }
                    ],
                    1: [
                        { ejercicio: "Peso Muerto Rumano Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Sillón Cuádriceps", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Puente de Glúteo", series: "3", rep: "15", peso: "—" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Press Hombro Manc.", series: "3", rep: "10", peso: "5kg" }
                    ],
                    2: [
                        { ejercicio: "Estocadas Mancuerna", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Abductores Banda", series: "3", rep: "20", peso: "—" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Press Hombro Mancuernas", series: "3", rep: "10", peso: "5kg" },
                        { ejercicio: "Fondos Banco", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Espinales", series: "3", rep: "15", peso: "—" }
                    ]
                }
            },
            {
                name: "M - 3 Días - Intermedio",
                level: "Intermedio",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust con Barra", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Sentadilla Búlgara", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "70kg" },
                        { ejercicio: "Sillón Cuádriceps", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Peso Muerto Sumo Barra", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Estocadas Cruzadas", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Abductores Máquina", series: "3", rep: "15", peso: "35kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Press de Pecho Plano Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "5kg" },
                        { ejercicio: "Curl de Bíceps Alterno", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Patada de Tríceps", series: "3", rep: "12", peso: "4kg" },
                        { ejercicio: "Espinales", series: "3", rep: "15", peso: "—" }
                    ],
                    2: [
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "70kg" },
                        { ejercicio: "Zancadas Cruzadas Manc.", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor en Polea", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "30kg" }
                    ]
                }
            },
            {
                name: "M - 3 Días - Avanzado",
                level: "Avanzado",
                days: "3 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust con Pausa 2\"", series: "4", rep: "8", peso: "50kg" },
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "45kg" },
                        { ejercicio: "Sentadilla Búlgara lastrada", series: "3", rep: "8", peso: "12kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "40kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Camilla Femoral Sentada", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Abductor en Máquina", series: "3", rep: "20", peso: "45kg" }
                    ],
                    1: [
                        { ejercicio: "Dominadas Asistidas", series: "4", rep: "8", peso: "—" },
                        { ejercicio: "Remo con Barra", series: "4", rep: "8", peso: "25kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Press Militar Manc.", series: "3", rep: "8", peso: "10kg" },
                        { ejercicio: "Elevación Lateral Polea", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "15", peso: "15kg" },
                        { ejercicio: "Tríceps Extensión Polea", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Curl Bíceps Barra W", series: "3", rep: "12", peso: "12kg" }
                    ],
                    2: [
                        { ejercicio: "Peso Muerto Sumo Barra", series: "4", rep: "8", peso: "55kg" },
                        { ejercicio: "Sentadilla Búlgara", series: "3", rep: "10", peso: "12kg" },
                        { ejercicio: "Hip Thrust Barra Pesado", series: "3", rep: "10", peso: "60kg" },
                        { ejercicio: "Zancadas Caminando", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Camilla Femoral Acostada", series: "4", rep: "10", peso: "25kg" },
                        { ejercicio: "Patada Glúteo Polea Cruzada", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Elevación de Talones", series: "3", rep: "15", peso: "15kg" },
                        { ejercicio: "Abductor en Máquina", series: "3", rep: "20", peso: "45kg" }
                    ]
                }
            },
            // --- 5 Días ---
            {
                name: "M - 5 Días - Principiante",
                level: "Principiante",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust Mancuerna", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Puente de Glúteo", series: "3", rep: "15", peso: "—" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "7kg" },
                        { ejercicio: "Abductor en Máquina", series: "3", rep: "15", peso: "25kg" },
                        { ejercicio: "Abductor Banda Caminata", series: "3", rep: "20", peso: "—" },
                        { ejercicio: "Camilla de Cuádriceps", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Estocadas Estáticas", series: "3", rep: "10", peso: "6kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Press Militar Manc.", series: "3", rep: "10", peso: "5kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "4kg" },
                        { ejercicio: "Curl Bíceps Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Tríceps Extensión", series: "3", rep: "12", peso: "10kg" }
                    ],
                    2: [
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Zancadas Estáticas Manc.", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Puente Glúteo una pierna", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Gemelos de Pie", series: "3", rep: "15", peso: "10kg" }
                    ],
                    3: [
                        { ejercicio: "Jalón Pecho Supino", series: "3", rep: "10", peso: "25kg" },
                        { ejercicio: "Remo Polea Baja", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Press Hombro Manc.", series: "3", rep: "10", peso: "5kg" },
                        { ejercicio: "Vuelos Laterales", series: "3", rep: "12", peso: "4kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Hiperextensiones", series: "3", rep: "15", peso: "—" },
                        { ejercicio: "Curl Martillo Manc.", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Tríceps Polea", series: "3", rep: "12", peso: "10kg" }
                    ],
                    4: [
                        { ejercicio: "Peso Muerto Rumano Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Estocadas Cruzadas Manc.", series: "3", rep: "10", peso: "6kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Puente Glúteo una pierna", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Abductores con Banda", series: "3", rep: "20", peso: "—" },
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "15kg" }
                    ]
                }
            },
            {
                name: "M - 5 Días - Intermedio",
                level: "Intermedio",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Sentadilla Barra", series: "4", rep: "8", peso: "30kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "80kg" },
                        { ejercicio: "Zancadas Búlgaras", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Sillón de Cuádriceps", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Camilla de Cuádriceps", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Estocadas Caminando", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Hip Thrust Mancuerna", series: "3", rep: "12", peso: "14kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "20kg" }
                    ],
                    1: [
                        { ejercicio: "Jalón al Pecho", series: "3", rep: "10", peso: "35kg" },
                        { ejercicio: "Remo Barra", series: "3", rep: "10", peso: "20kg" },
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Flexiones de Brazo", series: "3", rep: "12", peso: "—" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Copa Tríceps", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Curl Bíceps Alterno", series: "3", rep: "12", peso: "8kg" }
                    ],
                    2: [
                        { ejercicio: "Hip Thrust con Barra", series: "4", rep: "10", peso: "35kg" },
                        { ejercicio: "Hip Thrust con Banda", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Camilla Femoral Sentada", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Zancadas Cruzadas", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Abductor en Máquina", series: "3", rep: "15", peso: "35kg" }
                    ],
                    3: [
                        { ejercicio: "Remo con Mancuerna", series: "3", rep: "10", peso: "14kg" },
                        { ejercicio: "Jalón Agarre Cerrado", series: "3", rep: "10", peso: "30kg" },
                        { ejercicio: "Pull Over Polea Alta", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Press Militar Manc.", series: "3", rep: "10", peso: "8kg" },
                        { ejercicio: "Elevaciones Laterales", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "6kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Remo al Mentón Barra W", series: "3", rep: "10", peso: "20kg" }
                    ],
                    4: [
                        { ejercicio: "Peso Muerto Sumo", series: "4", rep: "8", peso: "40kg" },
                        { ejercicio: "Sentadilla Goblet", series: "3", rep: "10", peso: "14kg" },
                        { ejercicio: "Sillón Cuádriceps", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Zancadas Caminando", series: "3", rep: "12", peso: "8kg c/lado" },
                        { ejercicio: "Patada Glúteo Cruzada", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "10kg" },
                        { ejercicio: "Abductor Polea", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor Máquina", series: "3", rep: "15", peso: "35kg" }
                    ]
                }
            },
            {
                name: "M - 5 Días - Avanzado",
                level: "Avanzado",
                days: "5 días",
                data: {
                    0: [
                        { ejercicio: "Hip Thrust Barra Pesado", series: "4", rep: "8", peso: "60kg" },
                        { ejercicio: "Sentadilla Trasera Barra", series: "4", rep: "8", peso: "45kg" },
                        { ejercicio: "Sentadilla Sumo Mancuerna", series: "3", rep: "10", peso: "18kg" },
                        { ejercicio: "Estocadas Búlgaras Last.", series: "3", rep: "8", peso: "14kg" },
                        { ejercicio: "Prensa de Piernas", series: "3", rep: "10", peso: "100kg" },
                        { ejercicio: "Camilla Femoral", series: "3", rep: "12", peso: "25kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Abductor Máquina Pesado", series: "3", rep: "20", peso: "45kg" }
                    ],
                    1: [
                        { ejercicio: "Dominadas", series: "4", rep: "8", peso: "—" },
                        { ejercicio: "Remo Barra Pendlay", series: "4", rep: "8", peso: "30kg" },
                        { ejercicio: "Remo Mancuerna", series: "3", rep: "10", peso: "16kg" },
                        { ejercicio: "Jalón Pecho Cerrado", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Pull Over Polea Alta", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Vuelos Posteriores", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Face Pull", series: "3", rep: "12", peso: "15kg" },
                        { ejercicio: "Espinales Lastrados", series: "3", rep: "12", peso: "+5kg" }
                    ],
                    2: [
                        { ejercicio: "Peso Muerto Rumano", series: "4", rep: "8", peso: "45kg" },
                        { ejercicio: "Camilla Femoral Acostada", series: "4", rep: "10", peso: "30kg" },
                        { ejercicio: "Sentadilla Sumo Manc.", series: "3", rep: "10", peso: "18kg" },
                        { ejercicio: "Zancadas Cruzadas Déficit", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Hip Thrust con Banda", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Patada Glúteo Polea", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Abductor en Máquina", series: "3", rep: "20", peso: "45kg" },
                        { ejercicio: "Elevación Talones", series: "3", rep: "15", peso: "15kg" }
                    ],
                    3: [
                        { ejercicio: "Press Inclinado Manc.", series: "3", rep: "8", peso: "14kg" },
                        { ejercicio: "Pec Deck", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Fondos en Paralelas", series: "3", rep: "10", peso: "—" },
                        { ejercicio: "Press Militar Barra", series: "3", rep: "8", peso: "20kg" },
                        { ejercicio: "Elevación Lateral Polea", series: "4", rep: "12", peso: "8kg" },
                        { ejercicio: "Vuelos Posteriores Polea", series: "3", rep: "12", peso: "8kg" },
                        { ejercicio: "Tríceps Polea", series: "3", rep: "12", peso: "12kg" },
                        { ejercicio: "Curl Bíceps Scott Barra W", series: "3", rep: "12", peso: "12kg" }
                    ],
                    4: [
                        { ejercicio: "Hip Thrust con Barra", series: "4", rep: "10", peso: "50kg" },
                        { ejercicio: "Hip Thrust con Banda", series: "3", rep: "15", peso: "20kg" },
                        { ejercicio: "Sentadilla Sumo Barra", series: "3", rep: "10", peso: "40kg" },
                        { ejercicio: "Estocadas Búlgaras Déficit", series: "3", rep: "10", peso: "10kg" },
                        { ejercicio: "Camilla Femoral Sentada", series: "3", rep: "12", peso: "20kg" },
                        { ejercicio: "Patada Glúteo Polea Cruzada", series: "3", rep: "15", peso: "10kg" },
                        { ejercicio: "Abductor en Polea", series: "3", rep: "15", peso: "12kg" },
                        { ejercicio: "Zancadas Caminando", series: "3", rep: "12", peso: "10kg" }
                    ]
                }
            }
        ];

        const defaultRoutines = compactRoutines.map((r, idx) => ({
            id: idx + 1,
            name: r.name,
            level: r.level,
            days: r.days,
            exercises: createRoutineGrid(r.data),
            created_at: new Date().toISOString()
        }));

        localStorage.setItem('gym_routines_library', JSON.stringify(defaultRoutines));
        localStorage.setItem('gym_routines_library_v4', 'true');
        return defaultRoutines;
    }
    return JSON.parse(data);
}

function saveLocalLibraryRoutines(routines) {
    localStorage.setItem('gym_routines_library', JSON.stringify(routines));
}

async function loadLibraryRoutines() {
    if (useLocalLibrary) {
        return loadLocalLibraryRoutines();
    }
    try {
        const { data, error } = await window.supabaseApp
            .from('routines_library')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            if (error.message && error.message.includes('schema cache')) {
                console.warn('Supabase table routines_library not found. Falling back to localStorage.');
                useLocalLibrary = true;
                return loadLocalLibraryRoutines();
            }
            console.error('Error loading library routines from Supabase:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.warn('Supabase error, using localStorage fallback:', err);
        useLocalLibrary = true;
        return loadLocalLibraryRoutines();
    }
}

async function addLibraryRoutine(routine) {
    const routineData = routine.routine_data || routine.exercises || [];
    if (useLocalLibrary) {
        const routines = loadLocalLibraryRoutines();
        const newRoutine = {
            id: Date.now(),
            name: routine.name,
            level: routine.level,
            days: routine.days || '',
            exercises: routineData,
            created_at: new Date().toISOString()
        };
        routines.push(newRoutine);
        saveLocalLibraryRoutines(routines);
        return newRoutine;
    }

    try {
        const { data, error } = await window.supabaseApp
            .from('routines_library')
            .insert([{
                name: routine.name,
                level: routine.level,
                days: routine.days || '',
                exercises: routineData,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            if (error.message && error.message.includes('schema cache')) {
                useLocalLibrary = true;
                return addLibraryRoutine(routine);
            }
            console.error('Error adding library routine:', error);
            throw error;
        }
        return data;
    } catch (err) {
        useLocalLibrary = true;
        return addLibraryRoutine(routine);
    }
}

async function updateLibraryRoutine(routine) {
    const routineData = routine.routine_data || routine.exercises || [];
    if (useLocalLibrary) {
        const routines = loadLocalLibraryRoutines();
        const idx = routines.findIndex(r => r.id === routine.id);
        if (idx !== -1) {
            routines[idx].name = routine.name;
            routines[idx].level = routine.level;
            routines[idx].exercises = routineData;
            if (routine.days !== undefined) routines[idx].days = routine.days;
            saveLocalLibraryRoutines(routines);
        }
        return;
    }

    try {
        const updateData = {
            name: routine.name,
            level: routine.level,
            exercises: routineData,
        };
        if (routine.days !== undefined) updateData.days = routine.days;

        const { error } = await window.supabaseApp
            .from('routines_library')
            .update(updateData)
            .eq('id', routine.id);

        if (error) {
            if (error.message && error.message.includes('schema cache')) {
                useLocalLibrary = true;
                return updateLibraryRoutine(routine);
            }
            console.error('Error updating library routine:', error);
            throw error;
        }
    } catch (err) {
        useLocalLibrary = true;
        return updateLibraryRoutine(routine);
    }
}

async function deleteLibraryRoutine(id) {
    if (useLocalLibrary) {
        const routines = loadLocalLibraryRoutines();
        const filtered = routines.filter(r => r.id !== id);
        saveLocalLibraryRoutines(filtered);
        return;
    }

    try {
        const { error } = await window.supabaseApp
            .from('routines_library')
            .delete()
            .eq('id', id);

        if (error) {
            if (error.message && error.message.includes('schema cache')) {
                useLocalLibrary = true;
                return deleteLibraryRoutine(id);
            }
            console.error('Error deleting library routine:', error);
            throw error;
        }
    } catch (err) {
        useLocalLibrary = true;
        return deleteLibraryRoutine(id);
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

// ── Persistent Plan Prices Helper ────────────────────────────
function applyFeesToPlans(fees) {
    if (!fees) return;
    for (const [days, fee] of Object.entries(fees)) {
        if (fee === undefined || fee === null || isNaN(fee)) continue;
        const numFee = parseInt(fee);
        const opt = PLANS.estandar.options.find(o => String(o.days) === String(days));
        if (opt) {
            opt.fee = numFee;
            opt.label = `${days === 'libre' ? 'Pase Libre' : days + ' días'} — $${numFee.toLocaleString('es-AR')}`;
        }
    }
}

async function loadPlanPrices() {
    let fees = null;

    // 1. Try to fetch from Supabase 'settings' table (key = 'plan_prices')
    try {
        if (window.supabaseApp) {
            const { data, error } = await window.supabaseApp
                .from('settings')
                .select('value')
                .eq('key', 'plan_prices')
                .maybeSingle();

            if (!error && data && data.value) {
                fees = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
            }
        }
    } catch (e) {
        console.warn('[data.js] Could not fetch settings from Supabase:', e);
    }

    // 2. Fallback to localStorage
    if (!fees) {
        try {
            const local = localStorage.getItem('gym_plan_prices');
            if (local) fees = JSON.parse(local);
        } catch (e) {
            console.warn('[data.js] Could not parse localStorage gym_plan_prices:', e);
        }
    }

    // 3. Apply fees to PLANS object if loaded
    if (fees) {
        applyFeesToPlans(fees);
        try {
            localStorage.setItem('gym_plan_prices', JSON.stringify(fees));
        } catch (e) {}
    }
    return PLANS;
}

async function savePlanPrices(newFees) {
    // 1. Apply immediately in memory
    applyFeesToPlans(newFees);

    // 2. Save to localStorage
    try {
        localStorage.setItem('gym_plan_prices', JSON.stringify(newFees));
    } catch (e) {
        console.error('[data.js] Error saving to localStorage:', e);
    }

    // 3. Try to save to Supabase 'settings' table
    try {
        if (window.supabaseApp) {
            const { error } = await window.supabaseApp
                .from('settings')
                .upsert({ key: 'plan_prices', value: newFees }, { onConflict: 'key' });

            if (error) {
                console.warn('[data.js] Supabase settings upsert warning:', error.message);
            }
        }
    } catch (e) {
        console.warn('[data.js] Could not save plan prices to Supabase settings:', e);
    }
}

