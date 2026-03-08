// ============================================
// Split Component - Split Expenses Among Drivers
// ============================================

import { showToast }    from '../utils/toast.js';
import { showConfirm }  from '../utils/confirm.js';
import { updateSummary } from '../utils/summary.js';

const SPLIT_KEY = 'splitRecords';

function getStored() { return JSON.parse(localStorage.getItem(SPLIT_KEY) || '[]'); }
function save(data)  { localStorage.setItem(SPLIT_KEY, JSON.stringify(data)); }

let splitRecords = getStored();

// ── Init ────────────────────────────────────────────────────────
export function initSplitComponent() {
    const form = document.getElementById('split-form');
    if (form) form.addEventListener('submit', handleSubmit);

    const dateInput = document.getElementById('split-date');
    if (dateInput) dateInput.value = today();

    render();
}

// ── Helpers ─────────────────────────────────────────────────────
function today() {
    return new Date().toISOString().split('T')[0];
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Handlers ────────────────────────────────────────────────────
function handleSubmit(e) {
    e.preventDefault();

    const description  = document.getElementById('split-description').value.trim();
    const date         = document.getElementById('split-date').value;
    const totalAmount  = parseFloat(document.getElementById('split-amount').value);
    const participants = document.getElementById('split-participants').value
                            .split(',').map(p => p.trim()).filter(p => p);
    const splitType    = document.getElementById('split-type').value;

    if (description && date && totalAmount && participants.length > 0) {
        addRecord(description, date, totalAmount, participants, splitType);
        e.target.reset();
        document.getElementById('split-date').value = today();
        showToast(`Split "${description}" added - ₱${totalAmount.toFixed(2)}`, 'success');
    }
}

function addRecord(description, date, totalAmount, participants, splitType) {
    const perPersonAmount = totalAmount / participants.length;
    splitRecords.push({
        id: Date.now(), description, date, totalAmount,
        participants, splitType, perPersonAmount,
        settled: [], createdAt: new Date().toISOString()
    });
    save(splitRecords);
    render();
    updateSummary();
}

export async function deleteSplitRecord(id) {
    const record = splitRecords.find(r => r.id === id);
    const confirmed = await showConfirm(
        `Delete the split bill "${record ? record.description : 'this record'}"? This cannot be undone.`
    );
    if (!confirmed) return;

    splitRecords = splitRecords.filter(r => r.id !== id);
    save(splitRecords);
    render();
    updateSummary();
    showToast('Split bill deleted', 'info');
}

function settleSplitParticipant(recordId, name) {
    const record = splitRecords.find(r => r.id === recordId);
    if (record && !record.settled.includes(name)) {
        record.settled.push(name);
        save(splitRecords);
        render();
        updateSummary();
    }
}

function unsettleSplitParticipant(recordId, name) {
    const record = splitRecords.find(r => r.id === recordId);
    if (record) {
        record.settled = record.settled.filter(p => p !== name);
        save(splitRecords);
        render();
        updateSummary();
    }
}

function toggleSettle(recordId, name) {
    const record = splitRecords.find(r => r.id === recordId);
    if (!record) return;
    if (record.settled.includes(name)) {
        unsettleSplitParticipant(recordId, name);
        showToast(`${name} marked as unpaid`, 'warning');
    } else {
        settleSplitParticipant(recordId, name);
        showToast(`${name} paid ₱${record.perPersonAmount.toFixed(2)} ✓`, 'success');
    }
}

// ── Render ──────────────────────────────────────────────────────
function render() {
    const tbody     = document.getElementById('split-table-body');
    const empty     = document.getElementById('split-empty');
    const totalEl   = document.getElementById('split-total');
    const pendingEl = document.getElementById('split-pending');

    if (!tbody || !empty || !totalEl || !pendingEl) return;

    if (splitRecords.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        totalEl.textContent   = 'Total: ₱0.00';
        pendingEl.textContent = 'Pending: ₱0.00';
        return;
    }

    empty.classList.add('hidden');

    const total = splitRecords.reduce((s, r) => s + r.totalAmount, 0);
    const pendingAmount = splitRecords.reduce((s, r) => {
        const unsettled = r.participants.length - (r.settled ? r.settled.length : 0);
        return s + unsettled * r.perPersonAmount;
    }, 0);

    totalEl.textContent   = `Total: ₱${total.toFixed(2)}`;
    pendingEl.textContent = `Pending: ₱${pendingAmount.toFixed(2)}`;

    const sorted = [...splitRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(r => {
        const fullySettled = r.settled && r.settled.length === r.participants.length;
        const badgeClass   = fullySettled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
        const badgeText    = fullySettled ? 'SETTLED' : 'PENDING';

        const participantsHtml = r.participants.map(p => {
            const paid = r.settled && r.settled.includes(p);
            const pillClass = paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700';
            return `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full mr-1 mb-1 ${pillClass}">
                ${escapeHtml(p)}${paid ? ' ✓' : ''}
                <button onclick="toggleSettle(${r.id}, '${escapeHtml(p)}')"
                    class="opacity-60 hover:opacity-100 transition-opacity text-xs font-bold leading-none"
                    title="${paid ? 'Mark unpaid' : 'Mark paid'}">
                    ${paid ? '↩' : '✓'}
                </button>
            </span>`;
        }).join('');

        return `
        <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-6 py-3.5 text-sm font-medium text-slate-800">${escapeHtml(r.description)}</td>
            <td class="px-6 py-3.5 text-sm text-slate-500">${formatDate(r.date)}</td>
            <td class="px-6 py-3.5 text-sm font-semibold text-emerald-600">₱${r.totalAmount.toFixed(2)}</td>
            <td class="px-6 py-3.5 text-sm text-slate-500">${r.participants.length} people</td>
            <td class="px-6 py-3.5 text-sm font-semibold text-slate-700">₱${r.perPersonAmount.toFixed(2)}</td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full ${badgeClass}">
                    ${badgeText}
                </span>
            </td>
            <td class="px-6 py-3.5">
                <div class="flex flex-wrap max-w-xs">${participantsHtml}</div>
            </td>
            <td class="px-6 py-3.5">
                <button onclick="deleteSplitRecord(${r.id})"
                    class="text-xs font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-2.5 py-1 rounded-md transition-colors">
                    Delete
                </button>
            </td>
        </tr>`;
    }).join('');
}

// Make globally available
window.deleteSplitRecord = deleteSplitRecord;
window.toggleSettle      = toggleSettle;
