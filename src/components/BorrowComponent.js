// ============================================
// Borrow Component – Money Others Owe You (with Interest & Installments)
// ============================================

import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { updateSummary } from '../utils/summary.js';

const BORROW_KEY = 'borrowRecords';

function getStored() { return JSON.parse(localStorage.getItem(BORROW_KEY) || '[]'); }
function save(data) { localStorage.setItem(BORROW_KEY, JSON.stringify(data)); }

let borrowRecords = getStored();
let editingRecordId = null;
const selectedIds = new Set();

// ── Init ────────────────────────────────────────────────────────
export function initBorrowComponent() {
    const form = document.getElementById('borrow-form');
    if (form) form.addEventListener('submit', handleSubmit);

    const dateInput = document.getElementById('borrow-date');
    if (dateInput) dateInput.value = today();

    // Auto-calculate due date when installment months changes
    const installmentInput = document.getElementById('borrow-installment-months');
    const dueDateInput = document.getElementById('borrow-due-date');
    const borrowDateInput = document.getElementById('borrow-date');
    const amountInput = document.getElementById('borrow-amount');
    const interestInput = document.getElementById('borrow-interest-rate');
    
    if (installmentInput && dueDateInput) {
        installmentInput.addEventListener('change', function() {
            const months = parseInt(this.value) || 0;
            if (months > 0 && borrowDateInput && borrowDateInput.value) {
                const startDate = new Date(borrowDateInput.value);
                startDate.setMonth(startDate.getMonth() + months);
                const dueDateStr = startDate.toISOString().split('T')[0];
                dueDateInput.value = dueDateStr;
            }
            updatePaymentGuidePreview();
        });
        
        if (borrowDateInput) {
            borrowDateInput.addEventListener('change', function() {
                const months = parseInt(installmentInput.value) || 0;
                if (months > 0 && this.value) {
                    const startDate = new Date(this.value);
                    startDate.setMonth(startDate.getMonth() + months);
                    const dueDateStr = startDate.toISOString().split('T')[0];
                    dueDateInput.value = dueDateStr;
                }
            });
        }
    }

    if (amountInput) {
        amountInput.addEventListener('input', updatePaymentGuidePreview);
        amountInput.addEventListener('change', updatePaymentGuidePreview);
    }
    if (interestInput) {
        interestInput.addEventListener('input', updatePaymentGuidePreview);
        interestInput.addEventListener('change', updatePaymentGuidePreview);
    }
    if (installmentInput) {
        installmentInput.addEventListener('input', updatePaymentGuidePreview);
        installmentInput.addEventListener('change', updatePaymentGuidePreview);
    }

    const payForm = document.getElementById('borrow-pay-form');
    if (payForm) payForm.addEventListener('submit', handlePayFormSubmit);

    const payDateInput = document.getElementById('borrow-pay-date');
    if (payDateInput) payDateInput.value = today();

    const payClose = document.getElementById('borrow-pay-close');
    const payBackdrop = document.getElementById('borrow-pay-backdrop');
    if (payClose) payClose.addEventListener('click', closePayModal);
    if (payBackdrop) payBackdrop.addEventListener('click', closePayModal);

    const editForm = document.getElementById('borrow-manage-edit-form');
    if (editForm) editForm.addEventListener('submit', handleManageEditSubmit);

    const editClose = document.getElementById('borrow-edit-close');
    const editBackdrop = document.getElementById('borrow-edit-backdrop');
    if (editClose) editClose.addEventListener('click', closeEditModal);
    if (editBackdrop) editBackdrop.addEventListener('click', closeEditModal);

    const editSelect = document.getElementById('borrow-manage-edit-record');
    if (editSelect) editSelect.addEventListener('change', handleManageRecordSelection);

    const selectAll = document.getElementById('borrow-select-all');
    if (selectAll) selectAll.addEventListener('change', handleSelectAll);

    const editSelectedBtn = document.getElementById('borrow-edit-selected');
    if (editSelectedBtn) editSelectedBtn.addEventListener('click', editSelectedRecord);

    const deleteSelectedBtn = document.getElementById('borrow-delete-selected');
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelectedRecords);

    const summarySelect = document.getElementById('borrow-summary-borrower');
    if (summarySelect) summarySelect.addEventListener('change', renderBorrowerSummary);

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

function formatMoney(value) {
    return `₱${Number(value || 0).toFixed(2)}`;
}

function isOverdue(record) {
    if (!record.dueDate || record.status !== 'pending') return false;
    const todayMidnight = new Date(new Date().toDateString());
    return new Date(record.dueDate) < todayMidnight;
}

function calculateTotalWithInterest(amount, interestRate, installmentMonths) {
    if (!interestRate || interestRate <= 0) return amount;
    if (!installmentMonths || installmentMonths <= 1) {
        return amount + (amount * interestRate / 100);
    }
    return amount + (amount * interestRate / 100 * installmentMonths);
}

function calculateMonthlyPayment(totalWithInterest, installmentMonths) {
    if (!installmentMonths || installmentMonths <= 0) return totalWithInterest;
    return totalWithInterest / installmentMonths;
}

function updatePaymentGuidePreview() {
    const amount = parseFloat(document.getElementById('borrow-amount')?.value) || 0;
    const interestRate = parseFloat(document.getElementById('borrow-interest-rate')?.value) || 0;
    const installmentMonths = parseInt(document.getElementById('borrow-installment-months')?.value) || 0;
    
    const previewEl = document.getElementById('borrow-preview');
    if (!previewEl) return;
    
    if (!amount || amount <= 0 || !installmentMonths || installmentMonths <= 0) {
        previewEl.innerHTML = '';
        return;
    }
    
    const totalWithInterest = calculateTotalWithInterest(amount, interestRate, installmentMonths);
    const monthlyPayment = calculateMonthlyPayment(totalWithInterest, installmentMonths);
    const totalInterest = totalWithInterest - amount;
    
    if (interestRate > 0) {
        previewEl.innerHTML = `
            <div class="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                <div class="flex items-center gap-2 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                    <span class="text-sm font-semibold text-emerald-800">Payment Guide</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div class="bg-white rounded-lg p-2.5 border border-emerald-100">
                        <div class="text-xs text-slate-500 uppercase tracking-wider">Original</div>
                        <div class="font-semibold text-slate-700">${formatMoney(amount)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-2.5 border border-amber-100">
                        <div class="text-xs text-slate-500 uppercase tracking-wider">Interest (${interestRate}%×${installmentMonths}mo)</div>
                        <div class="font-semibold text-amber-700">+${formatMoney(totalInterest)}</div>
                    </div>
                    <div class="bg-white rounded-lg p-2.5 border border-emerald-100">
                        <div class="text-xs text-slate-500 uppercase tracking-wider">Total to Pay</div>
                        <div class="font-bold text-emerald-700">${formatMoney(totalWithInterest)}</div>
                    </div>
                    <div class="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg p-2.5 text-white">
                        <div class="text-xs text-emerald-100 uppercase tracking-wider">Monthly Payment</div>
                        <div class="font-bold text-lg">${formatMoney(monthlyPayment)}</div>
                        <div class="text-xs text-emerald-100">for ${installmentMonths} months</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        previewEl.innerHTML = `
            <div class="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div class="flex items-center gap-2 mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span class="text-sm font-semibold text-slate-700">Payment Guide</span>
                </div>
                <div class="flex items-center justify-between bg-white rounded-lg p-3 border border-slate-200">
                    <div>
                        <div class="text-xs text-slate-500 uppercase tracking-wider">Total Amount</div>
                        <div class="font-bold text-slate-700">${formatMoney(totalWithInterest)}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-xs text-slate-500 uppercase tracking-wider">Monthly</div>
                        <div class="font-bold text-emerald-600">${formatMoney(monthlyPayment)}</div>
                        <div class="text-xs text-slate-400">${installmentMonths} × ${formatMoney(monthlyPayment)}</div>
                    </div>
                </div>
            </div>
        `;
    }
}

// ── Handlers ────────────────────────────────────────────────────
function handleSubmit(e) {
    e.preventDefault();

    const borrower = document.getElementById('borrow-borrower').value.trim();
    const date = document.getElementById('borrow-date').value;
    const amount = parseFloat(document.getElementById('borrow-amount').value);
    const interestRate = parseFloat(document.getElementById('borrow-interest-rate').value) || 0;
    const installmentMonths = parseInt(document.getElementById('borrow-installment-months').value) || 0;
    const dueDate = document.getElementById('borrow-due-date').value;
    const alreadyPaid = document.getElementById('borrow-already-paid')?.checked || false;

    if (borrower && date && amount) {
        const totalWithInterest = calculateTotalWithInterest(amount, interestRate, installmentMonths);
        
        addRecord({
            borrower,
            date,
            amount,
            interestRate,
            installmentMonths,
            dueDate: dueDate || null,
            totalWithInterest,
            status: alreadyPaid ? 'paid' : 'pending',
            paidAmount: alreadyPaid ? totalWithInterest : 0,
            paymentHistory: alreadyPaid ? [{
                id: `${Date.now()}-initial`,
                date,
                amount: totalWithInterest,
                note: 'Initial payment'
            }] : []
        });

        e.target.reset();
        document.getElementById('borrow-date').value = today();
        if (alreadyPaid) {
            showToast(`${borrower} PAID you ${formatMoney(totalWithInterest)} ✓`, 'success');
        } else {
            const msg = interestRate > 0 && installmentMonths > 0
                ? `Loan for "${borrower}" added - ${formatMoney(amount)} + ${interestRate}%/mo interest for ${installmentMonths} months = ${formatMoney(totalWithInterest)}`
                : `Loan record for "${borrower}" added - ${formatMoney(amount)}`;
            showToast(msg, 'success');
        }
    }
}

function addRecord(record) {
    borrowRecords.push({
        id: Date.now(),
        ...record,
        createdAt: new Date().toISOString()
    });
    save(borrowRecords);
    render();
    updateSummary();
}

export async function deleteBorrowRecord(id) {
    const record = borrowRecords.find(r => r.id === id);
    const confirmed = await showConfirm(
        `Delete the loan record for "${record ? record.borrower : 'this borrower'}"? This cannot be undone.`
    );
    if (!confirmed) return;

    borrowRecords = borrowRecords.filter(r => r.id !== id);
    selectedIds.delete(id);
    save(borrowRecords);
    render();
    updateSummary();
    showToast('Loan record deleted', 'info');
}

export function toggleBorrowStatus(id) {
    const record = borrowRecords.find(r => r.id === id);
    if (!record) return;

    record.status = record.status === 'pending' ? 'paid' : 'pending';
    if (record.status === 'paid') {
        const remaining = record.totalWithInterest - record.paidAmount;
        record.paidAmount = record.totalWithInterest;
        record.paymentHistory.push({
            id: `${Date.now()}-full`,
            date: today(),
            amount: remaining,
            note: 'Full payment'
        });
    }
    save(borrowRecords);
    render();
    updateSummary();

    const msg = record.status === 'paid'
        ? `${record.borrower} PAID you ${formatMoney(record.totalWithInterest)} ✓`
        : `${record.borrower} marked as pending`;
    showToast(msg, record.status === 'paid' ? 'success' : 'warning');
}

// ── Modal Functions ──────────────────────────────────────────────
function openPayModal() {
    const modal = document.getElementById('borrow-pay-modal');
    if (modal) modal.classList.remove('hidden');
    refreshPayEditOptions();
}

function closePayModal() {
    const modal = document.getElementById('borrow-pay-modal');
    if (modal) modal.classList.add('hidden');
}

function openEditModal() {
    const modal = document.getElementById('borrow-edit-modal');
    if (modal) modal.classList.remove('hidden');
    refreshPayEditOptions();
}

function closeEditModal() {
    const modal = document.getElementById('borrow-edit-modal');
    if (modal) modal.classList.add('hidden');
}

function refreshPayEditOptions() {
    const paySelect = document.getElementById('borrow-pay-record');
    const editSelect = document.getElementById('borrow-manage-edit-record');

    const previousPay = paySelect ? paySelect.value : '';
    const previousEdit = editSelect ? editSelect.value : '';

    const optionHtml = borrowRecords
        .slice()
        .sort((a, b) => a.borrower.localeCompare(b.borrower))
        .map(r => {
            const label = `${escapeHtml(r.borrower)} - ${formatMoney(r.totalWithInterest)}`;
            return `<option value="${r.id}">${label}</option>`;
        }).join('');

    if (paySelect) {
        paySelect.innerHTML = `<option value="">Select borrower record</option>${optionHtml}`;
        if (previousPay && getRecordById(previousPay)) paySelect.value = previousPay;
    }

    if (editSelect) {
        editSelect.innerHTML = `<option value="">Select borrower record</option>${optionHtml}`;
        if (previousEdit && getRecordById(previousEdit)) editSelect.value = previousEdit;
        const selected = getRecordById(editSelect.value);
        fillManageEditForm(selected);
    }
}

function getRecordById(id) {
    return borrowRecords.find(r => r.id === Number(id));
}

function fillManageEditForm(record) {
    const borrowerInput = document.getElementById('borrow-manage-borrower');
    const dateInput = document.getElementById('borrow-manage-date');
    const amountInput = document.getElementById('borrow-manage-amount');
    const interestInput = document.getElementById('borrow-manage-interest');
    const installmentInput = document.getElementById('borrow-manage-installment');
    const dueDateInput = document.getElementById('borrow-manage-due-date');
    const totalInput = document.getElementById('borrow-manage-paid');

    if (!borrowerInput || !dateInput || !amountInput) return;

    borrowerInput.value = record?.borrower || '';
    dateInput.value = record?.date || today();
    amountInput.value = record ? record.amount.toFixed(2) : '';
    interestInput.value = record?.interestRate || '';
    installmentInput.value = record?.installmentMonths || '';
    dueDateInput.value = record?.dueDate || '';
    totalInput.value = record ? record.totalWithInterest.toFixed(2) : '';
}

function handleManageRecordSelection(e) {
    const record = getRecordById(e.target.value);
    fillManageEditForm(record);
}

function handleManageEditSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('borrow-manage-edit-record')?.value;
    const record = getRecordById(recordId);
    if (!record) return;

    const borrower = document.getElementById('borrow-manage-borrower')?.value.trim();
    const date = document.getElementById('borrow-manage-date')?.value;
    const amount = Number.parseFloat(document.getElementById('borrow-manage-amount')?.value || '');
    const interestRate = Number.parseFloat(document.getElementById('borrow-manage-interest')?.value || '0');
    const installmentMonths = Number.parseInt(document.getElementById('borrow-manage-installment')?.value || '0');
    const dueDate = document.getElementById('borrow-manage-due-date')?.value;
    const totalWithInterest = Number.parseFloat(document.getElementById('borrow-manage-paid')?.value || '');

    if (!borrower || !date || !Number.isFinite(amount)) {
        showToast('Please complete all required fields', 'warning');
        return;
    }

    record.borrower = borrower;
    record.date = date;
    record.amount = amount;
    record.interestRate = interestRate;
    record.installmentMonths = installmentMonths;
    record.dueDate = dueDate || null;
    record.totalWithInterest = totalWithInterest;

    save(borrowRecords);
    render();
    updateSummary();
    showToast(`Updated record for ${record.borrower}`, 'success');
    closeEditModal();
}

function handlePayFormSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('borrow-pay-record')?.value;
    const amount = Number.parseFloat(document.getElementById('borrow-pay-amount')?.value || '');
    const paymentDate = document.getElementById('borrow-pay-date')?.value || today();
    const note = document.getElementById('borrow-pay-note')?.value?.trim() || 'Payment update';

    const record = getRecordById(recordId);
    if (!record) return;
    if (!Number.isFinite(amount) || amount <= 0) {
        showToast('Invalid payment amount', 'warning');
        return;
    }

    record.paidAmount += amount;
    if (record.paidAmount >= record.totalWithInterest) {
        record.status = 'paid';
        record.paidAmount = record.totalWithInterest;
    }

    record.paymentHistory.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        date: paymentDate,
        amount,
        note
    });

    save(borrowRecords);
    render();
    updateSummary();

    const remaining = record.totalWithInterest - record.paidAmount;
    if (remaining > 0) {
        showToast(`Payment recorded. Remaining: ${formatMoney(remaining)}`, 'success');
    } else {
        showToast(`Payment recorded. ${record.borrower} is fully paid!`, 'success');
    }

    e.target.reset();
    const payDateInput = document.getElementById('borrow-pay-date');
    if (payDateInput) payDateInput.value = today();
    closePayModal();
}

// ── Selection Functions ─────────────────────────────────────────
function handleSelectAll(e) {
    const checked = e.target.checked;
    const rowCheckboxes = document.querySelectorAll('.borrow-row-checkbox');

    rowCheckboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
        checkbox.checked = checked;
    });

    syncSelectedCheckboxes();
}

function syncSelectedCheckboxes() {
    const validIds = new Set(borrowRecords.map(r => r.id));
    Array.from(selectedIds).forEach(id => {
        if (!validIds.has(id)) selectedIds.delete(id);
    });

    const rowCheckboxes = document.querySelectorAll('.borrow-row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        checkbox.checked = selectedIds.has(id);
    });

    const selectAll = document.getElementById('borrow-select-all');
    if (selectAll) {
        const selectableCount = rowCheckboxes.length;
        const selectedCount = selectedIds.size;
        selectAll.checked = selectableCount > 0 && selectedCount === selectableCount;
    }

    const editSelectedBtn = document.getElementById('borrow-edit-selected');
    if (editSelectedBtn) editSelectedBtn.disabled = selectedIds.size !== 1;

    const deleteSelectedBtn = document.getElementById('borrow-delete-selected');
    if (deleteSelectedBtn) deleteSelectedBtn.disabled = selectedIds.size === 0;
}

function attachRowSelectionEvents() {
    const rowCheckboxes = document.querySelectorAll('.borrow-row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const id = Number(checkbox.dataset.id);
            if (checkbox.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            syncSelectedCheckboxes();
        });
    });
}

async function deleteSelectedRecords() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = await showConfirm(`Delete ${ids.length} selected borrow record(s)? This cannot be undone.`);
    if (!confirmed) return;

    borrowRecords = borrowRecords.filter(r => !selectedIds.has(r.id));
    selectedIds.clear();
    save(borrowRecords);
    render();
    updateSummary();
    showToast('Selected borrow records deleted', 'info');
}

function editSelectedRecord() {
    if (selectedIds.size !== 1) {
        showToast('Select exactly one record to edit', 'warning');
        return;
    }

    const record = borrowRecords.find(r => selectedIds.has(r.id));
    if (!record) return;

    refreshPayEditOptions();
    openEditModal();

    const editSelect = document.getElementById('borrow-manage-edit-record');
    if (editSelect) {
        editSelect.value = String(record.id);
        fillManageEditForm(record);
    }
}

export function addBorrowPayment(id) {
    const record = borrowRecords.find(r => r.id === id);
    if (!record) return;

    refreshPayEditOptions();
    openPayModal();

    const paySelect = document.getElementById('borrow-pay-record');
    const payDate = document.getElementById('borrow-pay-date');
    const payAmount = document.getElementById('borrow-pay-amount');
    const payNote = document.getElementById('borrow-pay-note');

    if (paySelect) paySelect.value = String(record.id);
    if (payDate) payDate.value = today();
    if (payAmount) payAmount.value = '';
    if (payNote) payNote.value = '';

    if (payAmount) payAmount.focus();
}

export function editBorrowRecord(id) {
    const record = borrowRecords.find(r => r.id === id);
    if (!record) return;

    refreshPayEditOptions();
    openEditModal();

    const editSelect = document.getElementById('borrow-manage-edit-record');
    if (editSelect) {
        editSelect.value = String(record.id);
        fillManageEditForm(record);
    }
}

// ── Summary Functions ───────────────────────────────────────────
function updateBorrowerSummaryOptions() {
    const select = document.getElementById('borrow-summary-borrower');
    if (!select) return;

    const previous = select.value;
    const borrowers = [...new Set(borrowRecords.map(r => r.borrower).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">Select borrower</option>' +
        borrowers.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');

    if (previous && borrowers.includes(previous)) {
        select.value = previous;
    }
}

function renderBorrowerSummary() {
    const select = document.getElementById('borrow-summary-borrower');
    const totalBorrowedEl = document.getElementById('borrow-summary-total-borrowed');
    const totalInterestEl = document.getElementById('borrow-summary-total-interest');
    const totalPaidEl = document.getElementById('borrow-summary-total-paid');
    const remainingEl = document.getElementById('borrow-summary-remaining');
    const historyBody = document.getElementById('borrow-summary-history');
    const emptyEl = document.getElementById('borrow-summary-empty');

    if (!select || !totalBorrowedEl || !totalInterestEl || !totalPaidEl || !remainingEl || !historyBody || !emptyEl) return;

    const borrowerName = select.value;
    if (!borrowerName) {
        totalBorrowedEl.textContent = '₱0.00';
        totalInterestEl.textContent = '₱0.00';
        totalPaidEl.textContent = '₱0.00';
        remainingEl.textContent = '₱0.00';
        historyBody.innerHTML = '';
        emptyEl.textContent = 'Select a borrower to view payment history.';
        return;
    }

    const records = borrowRecords.filter(r => r.borrower === borrowerName);
    const totalBorrowed = records.reduce((sum, r) => sum + r.amount, 0);
    const totalInterest = records.reduce((sum, r) => sum + (r.totalWithInterest - r.amount), 0);
    const totalPaid = records.reduce((sum, r) => sum + r.paidAmount, 0);
    const remaining = records.reduce((sum, r) => sum + Math.max(0, r.totalWithInterest - r.paidAmount), 0);

    totalBorrowedEl.textContent = formatMoney(totalBorrowed);
    totalInterestEl.textContent = formatMoney(totalInterest);
    totalPaidEl.textContent = formatMoney(totalPaid);
    remainingEl.textContent = formatMoney(remaining);

    const paymentRows = records.flatMap(record => {
        if (!Array.isArray(record.paymentHistory) || record.paymentHistory.length === 0) {
            return [];
        }
        return record.paymentHistory.map(history => ({
            date: history.date || record.date,
            amount: history.amount,
            note: history.note || 'Payment'
        }));
    }).sort((a, b) => new Date(b.date) - new Date(a.date));

    if (paymentRows.length === 0) {
        historyBody.innerHTML = '';
        emptyEl.textContent = 'No payment history yet for this borrower.';
        return;
    }

    emptyEl.textContent = '';
    historyBody.innerHTML = paymentRows.map(row => `
        <tr class="hover:bg-emerald-50 hover:bg-opacity-30 transition-colors">
            <td class="px-4 py-3 text-sm text-slate-600">${formatDate(row.date)}</td>
            <td class="px-4 py-3 text-sm font-semibold text-emerald-700">${formatMoney(row.amount)}</td>
            <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(row.note)}</td>
        </tr>
    `).join('');
}

// ── Render ──────────────────────────────────────────────────────
function render() {
    const tbody = document.getElementById('borrow-table-body');
    const empty = document.getElementById('borrow-empty');
    const totalEl = document.getElementById('borrow-total');
    const pendingEl = document.getElementById('borrow-pending');

    if (!tbody || !empty || !totalEl || !pendingEl) return;

    if (borrowRecords.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        totalEl.textContent = 'Total: ₱0.00';
        pendingEl.textContent = 'Owed: ₱0.00';
        selectedIds.clear();
        syncSelectedCheckboxes();
        updateBorrowerSummaryOptions();
        renderBorrowerSummary();
        return;
    }

    empty.classList.add('hidden');

    const total = borrowRecords.reduce((s, r) => s + r.totalWithInterest, 0);
    const pending = borrowRecords.filter(r => r.status === 'pending').reduce((s, r) => s + (r.totalWithInterest - r.paidAmount), 0);

    totalEl.textContent = `Total: ${formatMoney(total)}`;
    pendingEl.textContent = `Owed: ${formatMoney(pending)}`;

    const sorted = [...borrowRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(r => {
        const isPaid = r.status === 'paid';
        const overdue = isOverdue(r);
        const remaining = r.totalWithInterest - r.paidAmount;
        const rowBg = overdue ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-emerald-50 hover:bg-opacity-30';

        let badgeClass, badgeDot, badgeText;
        if (isPaid) {
            badgeClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';
            badgeDot = 'bg-emerald-500';
            badgeText = 'PAID';
        } else if (overdue) {
            badgeClass = 'bg-red-100 text-red-700 border-red-200';
            badgeDot = 'bg-red-500';
            badgeText = 'OVERDUE';
        } else {
            badgeClass = 'bg-amber-100 text-amber-700 border-amber-200';
            badgeDot = 'bg-amber-400';
            badgeText = 'OWING';
        }

        let interestDisplay = r.interestRate > 0
            ? `${r.interestRate}%/mo × ${r.installmentMonths}mo`
            : '—';

        const monthlyPayment = r.installmentMonths > 0 
            ? calculateMonthlyPayment(r.totalWithInterest, r.installmentMonths)
            : 0;
        const monthlyDisplay = r.installmentMonths > 0
            ? formatMoney(monthlyPayment)
            : '—';

        let dueDateDisplay = '<span class="text-slate-400">—</span>';
        if (r.dueDate) {
            dueDateDisplay = overdue
                ? `<span class="text-red-600 font-semibold">${formatDate(r.dueDate)}</span>`
                : `<span class="text-slate-500">${formatDate(r.dueDate)}</span>`;
        }

        const toggleBtn = isPaid
            ? `<button onclick="toggleBorrowStatus(${r.id})" title="Mark as owing"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors border border-amber-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>
                    </svg>
                    Undo
               </button>`
            : `<button onclick="toggleBorrowStatus(${r.id})" title="Mark as paid"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors border border-emerald-200">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                    </svg>
                    Paid
               </button>`;

        return `
        <tr class="${rowBg} transition-colors">
            <td class="px-4 py-3.5">
                <input type="checkbox" class="borrow-row-checkbox w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" data-id="${r.id}">
            </td>
            <td class="px-4 py-3.5 text-sm font-semibold text-slate-800">${escapeHtml(r.borrower)}</td>
            <td class="px-4 py-3.5 text-sm text-slate-500">${formatDate(r.date)}</td>
            <td class="px-4 py-3.5 text-sm">${dueDateDisplay}</td>
            <td class="px-4 py-3.5 text-sm text-slate-600">${interestDisplay}</td>
            <td class="px-4 py-3.5">
                <span class="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-sm border border-emerald-100">${formatMoney(r.amount)}</span>
            </td>
            <td class="px-4 py-3.5">
                <span class="inline-flex items-center font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg text-sm border border-teal-100">${monthlyDisplay}</span>
            </td>
            <td class="px-4 py-3.5">
                <span class="inline-flex items-center font-semibold ${remaining > 0 ? 'text-amber-700 bg-amber-50' : 'text-slate-500 bg-slate-50'} px-2.5 py-1 rounded-lg text-sm border ${remaining > 0 ? 'border-amber-100' : 'border-slate-200'}">${formatMoney(remaining)}</span>
            </td>
            <td class="px-4 py-3.5">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${badgeClass}">
                    <span class="w-1.5 h-1.5 rounded-full ${badgeDot} shrink-0"></span>
                    ${badgeText}
                </span>
            </td>
            <td class="px-4 py-3.5">
                <div class="flex items-center gap-1.5">
                    <button onclick="addBorrowPayment(${r.id})" title="Add payment"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-700 hover:bg-emerald-50 border border-emerald-200">
                        Pay
                    </button>
                    <button onclick="editBorrowRecord(${r.id})" title="Edit record"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200">
                        Edit
                    </button>
                    <button onclick="deleteBorrowRecord(${r.id})" title="Delete record"
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
    updateBorrowerSummaryOptions();
    renderBorrowerSummary();
}

window.deleteBorrowRecord = deleteBorrowRecord;
window.toggleBorrowStatus = toggleBorrowStatus;
window.addBorrowPayment = addBorrowPayment;
window.editBorrowRecord = editBorrowRecord;

