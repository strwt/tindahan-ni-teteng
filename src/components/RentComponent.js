// ============================================
// Rent Component - Room Rent Tracking
// ============================================

import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { updateSummary } from '../utils/summary.js';

const RENT_KEY = 'taxiRentRecords';

function getStored() {
    return JSON.parse(localStorage.getItem(RENT_KEY) || '[]');
}

function save(data) {
    localStorage.setItem(RENT_KEY, JSON.stringify(data));
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
}

function formatMoney(value) {
    return `PHP ${Number(value || 0).toFixed(2)}`;
}

function toRecordModel(record) {
    const roomName = String(record.roomName ?? record.plateNumber ?? '').trim();
    const renterName = String(record.renterName ?? record.driverName ?? '').trim();
    const date = record.date || today();
    const rentAmount = Number(record.rentAmount ?? record.amount ?? 0);
    const paidAmount = Number(record.paidAmount ?? record.amount ?? 0);
    const period = (record.period === 'weekly' || record.period === 'monthly') ? record.period : 'monthly';

    const paymentHistory = Array.isArray(record.paymentHistory)
        ? record.paymentHistory
            .map(h => ({
                id: h.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                date: h.date || date,
                amount: Number(h.amount || 0),
                note: String(h.note || ''),
            }))
            .filter(h => Number.isFinite(h.amount) && h.amount > 0)
        : [];

    if (paymentHistory.length === 0 && paidAmount > 0) {
        paymentHistory.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date,
            amount: paidAmount,
            note: 'Initial payment',
        });
    }

    return {
        id: Number(record.id || Date.now()),
        roomName,
        renterName,
        date,
        period,
        rentAmount: Number.isFinite(rentAmount) ? Math.max(0, rentAmount) : 0,
        paidAmount: Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0,
        paymentHistory,
        createdAt: record.createdAt || new Date().toISOString(),
    };
}

function computeRemaining(record) {
    return Math.max(0, record.rentAmount - record.paidAmount);
}

function statusMeta(record) {
    const remaining = computeRemaining(record);
    if (remaining <= 0) {
        return {
            text: 'PAID',
            badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            dotClass: 'bg-emerald-500',
        };
    }
    if (record.paidAmount > 0) {
        return {
            text: 'PARTIAL',
            badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
            dotClass: 'bg-amber-500',
        };
    }
    return {
        text: 'UNPAID',
        badgeClass: 'bg-red-100 text-red-700 border-red-200',
        dotClass: 'bg-red-500',
    };
}

let rentRecords = getStored().map(toRecordModel);
let editingRecordId = null;
const selectedIds = new Set();

save(rentRecords);

export function initRentComponent() {
    const form = document.getElementById('rent-form');
    if (form) form.addEventListener('submit', handleSubmit);

    const dateInput = document.getElementById('rent-date');
    if (dateInput) dateInput.value = today();

    const selectAll = document.getElementById('rent-select-all');
    if (selectAll) selectAll.addEventListener('change', handleSelectAll);

    const editSelectedBtn = document.getElementById('rent-edit-selected');
    if (editSelectedBtn) editSelectedBtn.addEventListener('click', editSelectedRecord);

    const deleteSelectedBtn = document.getElementById('rent-delete-selected');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedRecords);

    const summarySelect = document.getElementById('rent-summary-renter');
    if (summarySelect) summarySelect.addEventListener('change', renderRenterSummary);

    const payForm = document.getElementById('rent-pay-form');
    if (payForm) payForm.addEventListener('submit', handlePayFormSubmit);

    const payDateInput = document.getElementById('rent-pay-date');
    if (payDateInput) payDateInput.value = today();

    const editManageForm = document.getElementById('rent-manage-edit-form');
    if (editManageForm) editManageForm.addEventListener('submit', handleManageEditSubmit);

    const editManageSelect = document.getElementById('rent-manage-edit-record');
    if (editManageSelect) editManageSelect.addEventListener('change', handleManageRecordSelection);

    const payClose = document.getElementById('rent-pay-close');
    const payBackdrop = document.getElementById('rent-pay-backdrop');
    if (payClose) payClose.addEventListener('click', closePayModal);
    if (payBackdrop) payBackdrop.addEventListener('click', closePayModal);

    const editClose = document.getElementById('rent-edit-close');
    const editBackdrop = document.getElementById('rent-edit-backdrop');
    if (editClose) editClose.addEventListener('click', closeEditModal);
    if (editBackdrop) editBackdrop.addEventListener('click', closeEditModal);

    render();
}

function setEditMode(record) {
    editingRecordId = record.id;

    document.getElementById('rent-item').value = record.roomName;
    document.getElementById('rent-renter').value = record.renterName;
    document.getElementById('rent-date').value = record.date;
    document.getElementById('rent-amount').value = record.rentAmount.toFixed(2);
    document.getElementById('rent-paid').value = record.paidAmount.toFixed(2);
    document.getElementById('rent-period').value = record.period;

    const submitBtn = document.getElementById('rent-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Update Record';
}

function clearEditMode() {
    editingRecordId = null;
    const submitBtn = document.getElementById('rent-submit-btn');
    if (submitBtn) submitBtn.textContent = 'Add Record';
}

function handleSubmit(e) {
    e.preventDefault();

    const roomName = document.getElementById('rent-item').value.trim();
    const renterName = document.getElementById('rent-renter').value.trim();
    const date = document.getElementById('rent-date').value;
    const rentAmount = Number.parseFloat(document.getElementById('rent-amount').value);
    const paidAmount = Number.parseFloat(document.getElementById('rent-paid').value);
    const period = document.getElementById('rent-period').value;

    if (!roomName || !renterName || !date || !Number.isFinite(rentAmount) || !Number.isFinite(paidAmount)) return;
    if (rentAmount <= 0 || paidAmount < 0) return;

    if (editingRecordId) {
        const record = rentRecords.find(r => r.id === editingRecordId);
        if (record) {
            const oldPaid = record.paidAmount;

            record.roomName = roomName;
            record.renterName = renterName;
            record.date = date;
            record.period = (period === 'weekly' || period === 'monthly') ? period : 'monthly';
            record.rentAmount = rentAmount;
            record.paidAmount = paidAmount;

            const delta = paidAmount - oldPaid;
            if (delta > 0) {
                record.paymentHistory.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    date: today(),
                    amount: delta,
                    note: 'Manual edit adjustment',
                });
            }

            showToast(`Updated record for ${renterName}`, 'success');
        }
    } else {
        const newRecord = toRecordModel({
            id: Date.now(),
            roomName,
            renterName,
            date,
            period,
            rentAmount,
            paidAmount,
            paymentHistory: paidAmount > 0
                ? [{ id: `${Date.now()}-initial`, date, amount: paidAmount, note: 'Initial payment' }]
                : [],
            createdAt: new Date().toISOString(),
        });

        rentRecords.push(newRecord);
        const remaining = computeRemaining(newRecord);
        if (remaining > 0) {
            showToast(`${renterName} paid ${formatMoney(paidAmount)}. Kulang: ${formatMoney(remaining)}`, 'warning');
        } else {
            showToast(`${renterName} payment recorded: ${formatMoney(paidAmount)}`, 'success');
        }
    }

    save(rentRecords);
    clearEditMode();
    e.target.reset();
    document.getElementById('rent-date').value = today();
    document.getElementById('rent-period').value = 'weekly';
    render();
    updateSummary();
}

function getRecordById(id) {
    return rentRecords.find(r => r.id === Number(id));
}

function openPayModal() {
    const modal = document.getElementById('rent-pay-modal');
    if (modal) modal.classList.remove('hidden');
}

function closePayModal() {
    const modal = document.getElementById('rent-pay-modal');
    if (modal) modal.classList.add('hidden');
}

function openEditModal() {
    const modal = document.getElementById('rent-edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeEditModal() {
    const modal = document.getElementById('rent-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function applyPayment(record, amount, paymentDate, note) {
    record.paidAmount += amount;
    record.paymentHistory.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: paymentDate || today(),
        amount,
        note: note || 'Manual payment update',
    });
}

function fillManageEditForm(record) {
    const roomInput = document.getElementById('rent-manage-room');
    const renterInput = document.getElementById('rent-manage-renter');
    const dateInput = document.getElementById('rent-manage-date');
    const periodInput = document.getElementById('rent-manage-period');
    const rentInput = document.getElementById('rent-manage-rent');
    const paidInput = document.getElementById('rent-manage-paid');

    if (!roomInput || !renterInput || !dateInput || !periodInput || !rentInput || !paidInput) return;

    roomInput.value = record?.roomName || '';
    renterInput.value = record?.renterName || '';
    dateInput.value = record?.date || today();
    periodInput.value = record?.period || 'weekly';
    rentInput.value = record ? record.rentAmount.toFixed(2) : '';
    paidInput.value = record ? record.paidAmount.toFixed(2) : '';
}

function refreshPayEditPageOptions() {
    const paySelect = document.getElementById('rent-pay-record');
    const editSelect = document.getElementById('rent-manage-edit-record');

    const previousPay = paySelect ? paySelect.value : '';
    const previousEdit = editSelect ? editSelect.value : '';

    const optionHtml = rentRecords
        .slice()
        .sort((a, b) => a.renterName.localeCompare(b.renterName) || a.roomName.localeCompare(b.roomName))
        .map(r => {
            const label = `${escapeHtml(r.renterName)} - ${escapeHtml(r.roomName)} (${escapeHtml(r.period)})`;
            return `<option value="${r.id}">${label}</option>`;
        }).join('');

    if (paySelect) {
        paySelect.innerHTML = `<option value="">Select renter record</option>${optionHtml}`;
        if (previousPay && getRecordById(previousPay)) paySelect.value = previousPay;
    }

    if (editSelect) {
        editSelect.innerHTML = `<option value="">Select renter record</option>${optionHtml}`;
        if (previousEdit && getRecordById(previousEdit)) editSelect.value = previousEdit;
        const selected = getRecordById(editSelect.value);
        fillManageEditForm(selected);
    }
}

function handlePayFormSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('rent-pay-record')?.value;
    const amount = Number.parseFloat(document.getElementById('rent-pay-amount')?.value || '');
    const paymentDate = document.getElementById('rent-pay-date')?.value || today();
    const note = document.getElementById('rent-pay-note')?.value?.trim() || 'Pay page update';

    const record = getRecordById(recordId);
    if (!record) return;
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Invalid payment amount', 'warning');
        return;
    }

    applyPayment(record, amount, paymentDate, note);
    save(rentRecords);
    render();
    updateSummary();

    const remaining = computeRemaining(record);
    if (remaining > 0) {
        showToast(`Payment recorded. Kulang left: ${formatMoney(remaining)}`, 'success');
    } else {
        showToast(`Payment recorded. ${record.renterName} is fully paid.`, 'success');
    }

    e.target.reset();
    const payDateInput = document.getElementById('rent-pay-date');
    if (payDateInput) payDateInput.value = today();
    closePayModal();
}

function handleManageRecordSelection(e) {
    const record = getRecordById(e.target.value);
    fillManageEditForm(record);
}

function handleManageEditSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('rent-manage-edit-record')?.value;
    const record = getRecordById(recordId);
    if (!record) return;

    const roomName = document.getElementById('rent-manage-room')?.value.trim();
    const renterName = document.getElementById('rent-manage-renter')?.value.trim();
    const date = document.getElementById('rent-manage-date')?.value;
    const period = document.getElementById('rent-manage-period')?.value;
    const rentAmount = Number.parseFloat(document.getElementById('rent-manage-rent')?.value || '');
    const paidAmount = Number.parseFloat(document.getElementById('rent-manage-paid')?.value || '');

    if (!roomName || !renterName || !date || !Number.isFinite(rentAmount) || !Number.isFinite(paidAmount)) {
        showToast('Please complete all edit fields', 'warning');
        return;
    }
    if (rentAmount <= 0 || paidAmount < 0) {
        showToast('Invalid rent or paid amount', 'warning');
        return;
    }

    const oldPaid = record.paidAmount;
    record.roomName = roomName;
    record.renterName = renterName;
    record.date = date;
    record.period = (period === 'weekly' || period === 'monthly') ? period : 'monthly';
    record.rentAmount = rentAmount;
    record.paidAmount = paidAmount;

    const delta = paidAmount - oldPaid;
    if (delta > 0) {
        record.paymentHistory.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            date: today(),
            amount: delta,
            note: 'Edit page adjustment',
        });
    }

    save(rentRecords);
    render();
    updateSummary();
    showToast(`Updated record for ${record.renterName}`, 'success');
    closeEditModal();
}

function getSelectedIds() {
    return Array.from(selectedIds);
}

function syncSelectedCheckboxes() {
    const validIds = new Set(rentRecords.map(r => r.id));
    Array.from(selectedIds).forEach(id => {
        if (!validIds.has(id)) selectedIds.delete(id);
    });

    const rowCheckboxes = document.querySelectorAll('.rent-row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        checkbox.checked = selectedIds.has(id);
    });

    const selectAll = document.getElementById('rent-select-all');
    if (selectAll) {
        const selectableCount = rowCheckboxes.length;
        const selectedCount = getSelectedIds().length;
        selectAll.checked = selectableCount > 0 && selectedCount === selectableCount;
    }

    const editSelectedBtn = document.getElementById('rent-edit-selected');
    if (editSelectedBtn) editSelectedBtn.disabled = getSelectedIds().length !== 1;

    const deleteSelectedBtn = document.getElementById('rent-delete-selected');
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = getSelectedIds().length === 0;
}

function attachRowSelectionEvents() {
    const rowCheckboxes = document.querySelectorAll('.rent-row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const id = Number(checkbox.dataset.id);
            if (checkbox.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            syncSelectedCheckboxes();
        });
    });
}

function handleSelectAll(e) {
    const checked = e.target.checked;
    const rowCheckboxes = document.querySelectorAll('.rent-row-checkbox');

    rowCheckboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
        checkbox.checked = checked;
    });

    syncSelectedCheckboxes();
}

async function deleteSelectedRecords() {
    const ids = getSelectedIds();
    if (ids.length === 0) return;

    const confirmed = await showConfirm(`Delete ${ids.length} selected rent record(s)? This cannot be undone.`);
    if (!confirmed) return;

    rentRecords = rentRecords.filter(r => !selectedIds.has(r.id));
    selectedIds.clear();
    save(rentRecords);
    render();
    updateSummary();
    showToast('Selected rent records deleted', 'info');
}

function editSelectedRecord() {
    const ids = getSelectedIds();
    if (ids.length !== 1) {
        showToast('Select exactly one record to edit', 'warning');
        return;
    }

    const record = rentRecords.find(r => r.id === ids[0]);
    if (!record) return;

    editRentRecord(record.id);
}

export async function deleteRentRecord(id) {
    const record = rentRecords.find(r => r.id === id);
    const label = record ? record.renterName : 'this renter';
    const confirmed = await showConfirm(`Delete the rent record for "${label}"? This cannot be undone.`);
    if (!confirmed) return;

    rentRecords = rentRecords.filter(r => r.id !== id);
    selectedIds.delete(id);
    save(rentRecords);
    render();
    updateSummary();
    showToast('Rent record deleted', 'info');
}

export function editRentRecord(id) {
    const record = rentRecords.find(r => r.id === id);
    if (!record) return;

    refreshPayEditPageOptions();
    openEditModal();

    const editSelect = document.getElementById('rent-manage-edit-record');
    if (editSelect) {
        editSelect.value = String(record.id);
        fillManageEditForm(record);
    }
}

export function addRentPayment(id) {
    const record = rentRecords.find(r => r.id === id);
    if (!record) return;

    refreshPayEditPageOptions();
    openPayModal();

    const paySelect = document.getElementById('rent-pay-record');
    const payDate = document.getElementById('rent-pay-date');
    const payAmount = document.getElementById('rent-pay-amount');
    const payNote = document.getElementById('rent-pay-note');

    if (paySelect) paySelect.value = String(record.id);
    if (payDate) payDate.value = today();
    if (payAmount) payAmount.value = '';
    if (payNote) payNote.value = '';

    if (payAmount) payAmount.focus();
}

function updateRenterSummaryOptions() {
    const select = document.getElementById('rent-summary-renter');
    if (!select) return;

    const previous = select.value;
    const renters = [...new Set(rentRecords.map(r => r.renterName).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">Select renter</option>' +
        renters.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    if (previous && renters.includes(previous)) {
        select.value = previous;
    }
}

function renderRenterSummary() {
    const select = document.getElementById('rent-summary-renter');
    const totalRentEl = document.getElementById('rent-summary-total-rent');
    const totalPaidEl = document.getElementById('rent-summary-total-paid');
    const totalKulangEl = document.getElementById('rent-summary-total-kulang');
    const historyBody = document.getElementById('rent-summary-history');
    const emptyEl = document.getElementById('rent-summary-empty');

    if (!select || !totalRentEl || !totalPaidEl || !totalKulangEl || !historyBody || !emptyEl) return;

    const renterName = select.value;
    if (!renterName) {
        totalRentEl.textContent = 'PHP 0.00';
        totalPaidEl.textContent = 'PHP 0.00';
        totalKulangEl.textContent = 'PHP 0.00';
        historyBody.innerHTML = '';
        emptyEl.textContent = 'Select a renter to view payment history.';
        return;
    }

    const records = rentRecords.filter(r => r.renterName === renterName);
    const totalRent = records.reduce((sum, r) => sum + r.rentAmount, 0);
    const totalPaid = records.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalKulang = records.reduce((sum, r) => sum + computeRemaining(r), 0);

    totalRentEl.textContent = formatMoney(totalRent);
    totalPaidEl.textContent = formatMoney(totalPaid);
    totalKulangEl.textContent = formatMoney(totalKulang);

    const paymentRows = records.flatMap(record => {
        if (!Array.isArray(record.paymentHistory) || record.paymentHistory.length === 0) {
            return [];
        }
        return record.paymentHistory.map(history => ({
            date: history.date || record.date,
            roomName: record.roomName,
            period: record.period,
            amount: history.amount,
            note: history.note || 'Payment',
        }));
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (paymentRows.length === 0) {
        historyBody.innerHTML = '';
        emptyEl.textContent = 'No payment history yet for this renter.';
        return;
    }

    emptyEl.textContent = '';
    historyBody.innerHTML = paymentRows.map(row => `
        <tr class="hover:bg-blue-50 hover:bg-opacity-30 transition-colors">
            <td class="px-4 py-3 text-sm text-slate-600">${formatDate(row.date)}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-800">${escapeHtml(row.roomName)}</td>
            <td class="px-4 py-3 text-sm text-slate-600 capitalize">${escapeHtml(row.period)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-emerald-700">${formatMoney(row.amount)}</td>
            <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(row.note)}</td>
        </tr>
    `).join('');
}

function render() {
    const tbody = document.getElementById('rent-table-body');
    const empty = document.getElementById('rent-empty');
    const totalEl = document.getElementById('rent-total');

    if (!tbody || !empty || !totalEl) return;

    if (rentRecords.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        totalEl.textContent = 'Rent: PHP 0.00 | Paid: PHP 0.00 | Kulang: PHP 0.00';
        selectedIds.clear();
        syncSelectedCheckboxes();
        updateRenterSummaryOptions();
        refreshPayEditPageOptions();
        renderRenterSummary();
        return;
    }

    empty.classList.add('hidden');

    const totalRent = rentRecords.reduce((sum, r) => sum + r.rentAmount, 0);
    const totalPaid = rentRecords.reduce((sum, r) => sum + r.paidAmount, 0);
    const totalKulang = rentRecords.reduce((sum, r) => sum + computeRemaining(r), 0);
    totalEl.textContent = `Rent: ${formatMoney(totalRent)} | Paid: ${formatMoney(totalPaid)} | Kulang: ${formatMoney(totalKulang)}`;

    const sorted = [...rentRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(record => {
        const status = statusMeta(record);
        const remaining = computeRemaining(record);

        return `
        <tr class="hover:bg-blue-50 hover:bg-opacity-30 transition-colors">
            <td class="px-4 py-3.5">
                <input type="checkbox" class="rent-row-checkbox w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" data-id="${record.id}">
            </td>
            <td class="px-6 py-3.5 text-sm font-semibold text-slate-800">${escapeHtml(record.roomName)}</td>
            <td class="px-6 py-3.5 text-sm text-slate-600">${escapeHtml(record.renterName)}</td>
            <td class="px-6 py-3.5 text-sm text-slate-500">${formatDate(record.date)}</td>
            <td class="px-6 py-3.5 text-sm text-slate-600 capitalize">${escapeHtml(record.period)}</td>
            <td class="px-6 py-3.5"><span class="inline-flex items-center font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg text-sm border border-blue-100">${formatMoney(record.rentAmount)}</span></td>
            <td class="px-6 py-3.5"><span class="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-sm border border-emerald-100">${formatMoney(record.paidAmount)}</span></td>
            <td class="px-6 py-3.5"><span class="inline-flex items-center font-semibold ${remaining > 0 ? 'text-amber-700 bg-amber-50 border-amber-100' : 'text-slate-500 bg-slate-50 border-slate-200'} px-2.5 py-1 rounded-lg text-sm border">${formatMoney(remaining)}</span></td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${status.badgeClass}">
                    <span class="w-1.5 h-1.5 rounded-full ${status.dotClass} shrink-0"></span>${status.text}
                </span>
            </td>
            <td class="px-6 py-3.5">
                <div class="flex items-center gap-1.5">
                    <button onclick="addRentPayment(${record.id})" title="Add payment"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200">
                        Pay
                    </button>
                    <button onclick="editRentRecord(${record.id})" title="Edit record"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200">
                        Edit
                    </button>
                    <button onclick="deleteRentRecord(${record.id})" title="Delete record"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    attachRowSelectionEvents();
    syncSelectedCheckboxes();
    updateRenterSummaryOptions();
    refreshPayEditPageOptions();
    renderRenterSummary();
}

window.deleteRentRecord = deleteRentRecord;
window.editRentRecord = editRentRecord;
window.addRentPayment = addRentPayment;
