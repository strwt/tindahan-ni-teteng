// ============================================
// Sari-Sari Store Component - Expenses and Sales
// ============================================

import { showToast } from '../utils/toast.js';
import { showConfirm } from '../utils/confirm.js';
import { updateSummary } from '../utils/summary.js';
import { exportExpenseRecordsToPdf, exportSalesRecordsToPdf } from '../utils/exportPdf.js';

const EXPENSE_KEY = 'expenseRecords';
const SALES_KEY = 'salesRecords';

function getStoredExpenses() { return JSON.parse(localStorage.getItem(EXPENSE_KEY) || '[]'); }
function saveExpenses(data) { localStorage.setItem(EXPENSE_KEY, JSON.stringify(data)); }

function getStoredSales() { return JSON.parse(localStorage.getItem(SALES_KEY) || '[]'); }
function saveSales(data) { localStorage.setItem(SALES_KEY, JSON.stringify(data)); }

let expenseRecords = getStoredExpenses();
let salesRecords = getStoredSales();

const expenseSelectedIds = new Set();
const salesSelectedIds = new Set();

// ── Init ────────────────────────────────────────────────────────
export function initStoreComponent() {
    const expenseForm = document.getElementById('expense-form');
    if (expenseForm) expenseForm.addEventListener('submit', handleExpenseSubmit);

    const expenseDate = document.getElementById('expense-date');
    if (expenseDate) expenseDate.value = today();

    const salesForm = document.getElementById('sales-form');
    if (salesForm) salesForm.addEventListener('submit', handleSalesSubmit);

    const salesDate = document.getElementById('sales-date');
    if (salesDate) salesDate.value = today();

    initExpenseEditModal();
    initSalesEditModal();

    const expenseExportPdf = document.getElementById('expense-export-pdf');
    if (expenseExportPdf) expenseExportPdf.addEventListener('click', handleExpenseExportPdf);

    const expenseEditSelected = document.getElementById('expense-edit-selected');
    if (expenseEditSelected) expenseEditSelected.addEventListener('click', handleExpenseEditSelected);

    const expenseDeleteSelected = document.getElementById('expense-delete-selected');
    if (expenseDeleteSelected) expenseDeleteSelected.addEventListener('click', handleExpenseDeleteSelected);

    const expenseSelectAll = document.getElementById('expense-select-all');
    if (expenseSelectAll) expenseSelectAll.addEventListener('change', handleExpenseSelectAll);

    const salesExportPdf = document.getElementById('sales-export-pdf');
    if (salesExportPdf) salesExportPdf.addEventListener('click', handleSalesExportPdf);

    const salesEditSelected = document.getElementById('sales-edit-selected');
    if (salesEditSelected) salesEditSelected.addEventListener('click', handleSalesEditSelected);

    const salesDeleteSelected = document.getElementById('sales-delete-selected');
    if (salesDeleteSelected) salesDeleteSelected.addEventListener('click', handleSalesDeleteSelected);

    const salesSelectAll = document.getElementById('sales-select-all');
    if (salesSelectAll) salesSelectAll.addEventListener('change', handleSalesSelectAll);

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

function getDateRange(type) {
    const now = new Date();
    const start = new Date();
    
    if (type === 'daily') {
        start.setHours(0, 0, 0, 0);
        now.setHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
    } else if (type === 'monthly') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
    }
    
    return { start, end: now };
}

// ── Expense Handlers ────────────────────────────────────────────────────
function handleExpenseSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('expense-name').value.trim();
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    const amount = parseFloat(document.getElementById('expense-amount').value);

    if (name && category && date && amount) {
        addExpense(name, category, date, amount);
        e.target.reset();
        document.getElementById('expense-date').value = today();
        showToast(`Expense "${name}" added — ₱${amount.toFixed(2)}`, 'success');
    }
}

function addExpense(name, category, date, amount) {
    expenseRecords.push({
        id: Date.now(),
        name,
        category,
        date,
        amount,
        createdAt: new Date().toISOString()
    });
    saveExpenses(expenseRecords);
    render();
    updateSummary();
}

export async function deleteExpenseRecord(id) {
    const record = expenseRecords.find(r => r.id === id);
    const confirmed = await showConfirm(
        `Delete the expense record for "${record ? record.name : 'this item'}"? This cannot be undone.`
    );
    if (!confirmed) return;

    expenseRecords = expenseRecords.filter(r => r.id !== id);
    expenseSelectedIds.delete(id);
    saveExpenses(expenseRecords);
    render();
    updateSummary();
    showToast('Expense record deleted', 'info');
}

// ── Sales Handlers ────────────────────────────────────────────────────
function handleSalesSubmit(e) {
    e.preventDefault();

    const sales = parseFloat(document.getElementById('sales-amount').value);
    const status = document.getElementById('sales-status').value;
    const date = document.getElementById('sales-date').value;

    if (sales && status && date) {
        addSales(sales, status, date);
        e.target.reset();
        document.getElementById('sales-date').value = today();
        showToast(`Sales of ₱${sales.toFixed(2)} added (${status})`, 'success');
    }
}

function addSales(sales, status, date) {
    salesRecords.push({
        id: Date.now(),
        sales,
        status,
        date,
        createdAt: new Date().toISOString()
    });
    saveSales(salesRecords);
    render();
    updateSummary();
}

export async function deleteSalesRecord(id) {
    const record = salesRecords.find(r => r.id === id);
    const confirmed = await showConfirm(
        `Delete this sales record? This cannot be undone.`
    );
    if (!confirmed) return;

    salesRecords = salesRecords.filter(r => r.id !== id);
    salesSelectedIds.delete(id);
    saveSales(salesRecords);
    render();
    updateSummary();
    showToast('Sales record deleted', 'info');
}

// ── Render ──────────────────────────────────────────────────────
function render() {
    renderExpenses();
    renderSales();
    renderSummary();
}

function renderExpenses() {
    const tbody = document.getElementById('expense-table-body');
    const empty = document.getElementById('expense-empty');
    const totalEl = document.getElementById('expense-total');

    if (!tbody || !empty || !totalEl) return;

    if (expenseRecords.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        totalEl.textContent = 'Total Expenses: ₱0.00';
        return;
    }

    empty.classList.add('hidden');

    const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0);
    totalEl.textContent = `Total Expenses: ₱${totalExpenses.toFixed(2)}`;

    const sorted = [...expenseRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    const categoryColors = {
        'Store Grocery': 'bg-amber-50 text-amber-700 border-amber-100',
        'Utilities': 'bg-blue-50 text-blue-700 border-blue-100',
        'Repair and Maintenance': 'bg-orange-50 text-orange-700 border-orange-100',
        'Beverages': 'bg-purple-50 text-purple-700 border-purple-100'
    };

    tbody.innerHTML = sorted.map(r => {
        const badgeClass = categoryColors[r.category] || 'bg-slate-50 text-slate-700 border-slate-100';
        
        return `
        <tr class="hover:bg-red-50 hover:bg-opacity-30 transition-colors">
            <td class="px-4 py-3.5">
                <input type="checkbox" class="expense-row-checkbox w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500" data-id="${r.id}">
            </td>
            <td class="px-6 py-3.5 text-sm font-semibold text-slate-800">${escapeHtml(r.name)}</td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center font-medium px-2.5 py-1 rounded-lg text-sm border ${badgeClass}">${escapeHtml(r.category)}</span>
            </td>
            <td class="px-6 py-3.5 text-sm text-slate-500">${formatDate(r.date)}</td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-lg text-sm border border-red-100">₱${r.amount.toFixed(2)}</span>
            </td>
            <td class="px-6 py-3.5">
                <div class="flex items-center gap-1.5">
                    <button onclick="editExpenseRecord(${r.id})" title="Edit record"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200">
                        Edit
                    </button>
                    <button onclick="deleteExpenseRecord(${r.id})" title="Delete record"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
    
    attachExpenseRowEvents();
    syncExpenseCheckboxes();
}

function renderSales() {
    const tbody = document.getElementById('sales-table-body');
    const empty = document.getElementById('sales-empty');
    const totalEl = document.getElementById('sales-total');

    if (!tbody || !empty || !totalEl) return;

    if (salesRecords.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        totalEl.textContent = 'Total Sales: ₱0.00';
        return;
    }

    empty.classList.add('hidden');

    const totalSales = salesRecords.reduce((s, r) => s + r.sales, 0);
    totalEl.textContent = `Total Sales: ₱${totalSales.toFixed(2)}`;

    const sorted = [...salesRecords].sort((a, b) => new Date(b.date) - new Date(a.date));

    const statusColors = {
        'Daily': 'bg-emerald-50 text-emerald-700 border-emerald-100',
        'Weekly': 'bg-blue-50 text-blue-700 border-blue-100',
        'Monthly': 'bg-violet-50 text-violet-700 border-violet-100'
    };

    tbody.innerHTML = sorted.map(r => {
        const badgeClass = statusColors[r.status] || 'bg-slate-50 text-slate-700 border-slate-100';
        
        return `
        <tr class="hover:bg-emerald-50 hover:bg-opacity-30 transition-colors">
            <td class="px-4 py-3.5">
                <input type="checkbox" class="sales-row-checkbox w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" data-id="${r.id}">
            </td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-sm border border-emerald-100">₱${r.sales.toFixed(2)}</span>
            </td>
            <td class="px-6 py-3.5">
                <span class="inline-flex items-center font-medium px-2.5 py-1 rounded-lg text-sm border ${badgeClass}">${escapeHtml(r.status)}</span>
            </td>
            <td class="px-6 py-3.5 text-sm text-slate-500">${formatDate(r.date)}</td>
            <td class="px-6 py-3.5">
                <div class="flex items-center gap-1.5">
                    <button onclick="editSalesRecord(${r.id})" title="Edit record"
                        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 border border-blue-200">
                        Edit
                    </button>
                    <button onclick="deleteSalesRecord(${r.id})" title="Delete record"
                        class="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
    
    attachSalesRowEvents();
    syncSalesCheckboxes();
}

function renderSummary() {
    const dailyEl = document.getElementById('store-daily-sales');
    const weeklyEl = document.getElementById('store-weekly-sales');
    const monthlyEl = document.getElementById('store-monthly-sales');

    if (!dailyEl || !weeklyEl || !monthlyEl) return;

    const todayStr = today();
    const currentDate = new Date(todayStr);
    
    const dailySales = salesRecords
        .filter(r => r.date === todayStr)
        .reduce((s, r) => s + r.sales, 0);
    
    const weekStart = new Date(currentDate);
    const day = currentDate.getDay();
    const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    
    const weeklySales = salesRecords
        .filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= weekStart;
        })
        .reduce((s, r) => s + r.sales, 0);
    
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const monthlySales = salesRecords
        .filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= monthStart;
        })
        .reduce((s, r) => s + r.sales, 0);

    dailyEl.textContent = `₱${dailySales.toFixed(2)}`;
    weeklyEl.textContent = `₱${weeklySales.toFixed(2)}`;
    monthlyEl.textContent = `₱${monthlySales.toFixed(2)}`;
}

window.deleteExpenseRecord = deleteExpenseRecord;
window.deleteSalesRecord = deleteSalesRecord;
window.editExpenseRecord = editExpenseRecord;
window.editSalesRecord = editSalesRecord;

// ── Expense Edit Modal Functions ────────────────────────────────────────
function initExpenseEditModal() {
    const closeBtn = document.getElementById('expense-edit-close');
    const backdrop = document.getElementById('expense-edit-backdrop');
    const form = document.getElementById('expense-manage-edit-form');

    if (closeBtn) closeBtn.addEventListener('click', closeExpenseEditModal);
    if (backdrop) backdrop.addEventListener('click', closeExpenseEditModal);
    if (form) form.addEventListener('submit', handleExpenseEditSubmit);
}

function openExpenseEditModal() {
    const modal = document.getElementById('expense-edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeExpenseEditModal() {
    const modal = document.getElementById('expense-edit-modal');
    if (modal) modal.classList.add('hidden');
}

export function editExpenseRecord(id) {
    const record = expenseRecords.find(r => r.id === id);
    if (!record) return;

    document.getElementById('expense-manage-name').value = record.name;
    document.getElementById('expense-manage-category').value = record.category;
    document.getElementById('expense-manage-date').value = record.date;
    document.getElementById('expense-manage-amount').value = record.amount.toFixed(2);

    document.getElementById('expense-manage-edit-form').dataset.editId = id;
    openExpenseEditModal();
}

function handleExpenseEditSubmit(e) {
    e.preventDefault();
    const id = parseInt(e.target.dataset.editId);
    if (!id) return;

    const name = document.getElementById('expense-manage-name').value.trim();
    const category = document.getElementById('expense-manage-category').value;
    const date = document.getElementById('expense-manage-date').value;
    const amount = parseFloat(document.getElementById('expense-manage-amount').value);

    if (!name || !category || !date || !amount) return;

    const record = expenseRecords.find(r => r.id === id);
    if (record) {
        record.name = name;
        record.category = category;
        record.date = date;
        record.amount = amount;
        saveExpenses(expenseRecords);
        render();
        updateSummary();
        showToast(`Expense "${name}" updated`, 'success');
    }

    closeExpenseEditModal();
}

// ── Sales Edit Modal Functions ────────────────────────────────────────
function initSalesEditModal() {
    const closeBtn = document.getElementById('sales-edit-close');
    const backdrop = document.getElementById('sales-edit-backdrop');
    const form = document.getElementById('sales-manage-edit-form');

    if (closeBtn) closeBtn.addEventListener('click', closeSalesEditModal);
    if (backdrop) backdrop.addEventListener('click', closeSalesEditModal);
    if (form) form.addEventListener('submit', handleSalesEditSubmit);
}

function openSalesEditModal() {
    const modal = document.getElementById('sales-edit-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeSalesEditModal() {
    const modal = document.getElementById('sales-edit-modal');
    if (modal) modal.classList.add('hidden');
}

export function editSalesRecord(id) {
    const record = salesRecords.find(r => r.id === id);
    if (!record) return;

    document.getElementById('sales-manage-amount').value = record.sales.toFixed(2);
    document.getElementById('sales-manage-status').value = record.status;
    document.getElementById('sales-manage-date').value = record.date;

    document.getElementById('sales-manage-edit-form').dataset.editId = id;
    openSalesEditModal();
}

function handleSalesEditSubmit(e) {
    e.preventDefault();
    const id = parseInt(e.target.dataset.editId);
    if (!id) return;

    const sales = parseFloat(document.getElementById('sales-manage-amount').value);
    const status = document.getElementById('sales-manage-status').value;
    const date = document.getElementById('sales-manage-date').value;

    if (!sales || !status || !date) return;

    const record = salesRecords.find(r => r.id === id);
    if (record) {
        record.sales = sales;
        record.status = status;
        record.date = date;
        saveSales(salesRecords);
        render();
        updateSummary();
        showToast(`Sales record updated`, 'success');
    }

    closeSalesEditModal();
}

// ── PDF Export Handlers ────────────────────────────────────────────────
function handleExpenseExportPdf() {
    const records = getStoredExpenses();
    exportExpenseRecordsToPdf({ title: 'Expense Records Report', records, filename: 'expense-records' });
    showToast('Exporting expense records to PDF...', 'info');
}

function handleSalesExportPdf() {
    const records = getStoredSales();
    exportSalesRecordsToPdf({ title: 'Sales Records Report', records, filename: 'sales-records' });
    showToast('Exporting sales records to PDF...', 'info');
}

// ── Expense Selection Handlers ────────────────────────────────────────
function handleExpenseSelectAll(e) {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.expense-row-checkbox');
    checkboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        if (checked) expenseSelectedIds.add(id);
        else expenseSelectedIds.delete(id);
        checkbox.checked = checked;
    });
    syncExpenseCheckboxes();
}

function syncExpenseCheckboxes() {
    const validIds = new Set(expenseRecords.map(r => r.id));
    Array.from(expenseSelectedIds).forEach(id => { if (!validIds.has(id)) expenseSelectedIds.delete(id); });
    const checkboxes = document.querySelectorAll('.expense-row-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = expenseSelectedIds.has(Number(checkbox.dataset.id)); });
    const selectAll = document.getElementById('expense-select-all');
    if (selectAll) selectAll.checked = checkboxes.length > 0 && expenseSelectedIds.size === checkboxes.length;
    const editBtn = document.getElementById('expense-edit-selected');
    if (editBtn) editBtn.disabled = expenseSelectedIds.size !== 1;
    const deleteBtn = document.getElementById('expense-delete-selected');
    if (deleteBtn) deleteBtn.disabled = expenseSelectedIds.size === 0;
}

function attachExpenseRowEvents() {
    const checkboxes = document.querySelectorAll('.expense-row-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const id = Number(checkbox.dataset.id);
            if (checkbox.checked) expenseSelectedIds.add(id);
            else expenseSelectedIds.delete(id);
            syncExpenseCheckboxes();
        });
    });
}

function handleExpenseEditSelected() {
    const ids = Array.from(expenseSelectedIds);
    if (ids.length !== 1) { showToast('Select exactly one record to edit', 'warning'); return; }
    editExpenseRecord(ids[0]);
}

async function handleExpenseDeleteSelected() {
    const ids = Array.from(expenseSelectedIds);
    if (ids.length === 0) return;
    const confirmed = await showConfirm(`Delete ${ids.length} expense record(s)? This cannot be undone.`);
    if (!confirmed) return;
    expenseRecords = expenseRecords.filter(r => !expenseSelectedIds.has(r.id));
    expenseSelectedIds.clear();
    saveExpenses(expenseRecords);
    render();
    updateSummary();
    showToast('Expense records deleted', 'info');
}

// ── Sales Selection Handlers ────────────────────────────────────────
function handleSalesSelectAll(e) {
    const checked = e.target.checked;
    const checkboxes = document.querySelectorAll('.sales-row-checkbox');
    checkboxes.forEach(checkbox => {
        const id = Number(checkbox.dataset.id);
        if (checked) salesSelectedIds.add(id);
        else salesSelectedIds.delete(id);
        checkbox.checked = checked;
    });
    syncSalesCheckboxes();
}

function syncSalesCheckboxes() {
    const validIds = new Set(salesRecords.map(r => r.id));
    Array.from(salesSelectedIds).forEach(id => { if (!validIds.has(id)) salesSelectedIds.delete(id); });
    const checkboxes = document.querySelectorAll('.sales-row-checkbox');
    checkboxes.forEach(checkbox => { checkbox.checked = salesSelectedIds.has(Number(checkbox.dataset.id)); });
    const selectAll = document.getElementById('sales-select-all');
    if (selectAll) selectAll.checked = checkboxes.length > 0 && salesSelectedIds.size === checkboxes.length;
    const editBtn = document.getElementById('sales-edit-selected');
    if (editBtn) editBtn.disabled = salesSelectedIds.size !== 1;
    const deleteBtn = document.getElementById('sales-delete-selected');
    if (deleteBtn) deleteBtn.disabled = salesSelectedIds.size === 0;
}

function attachSalesRowEvents() {
    const checkboxes = document.querySelectorAll('.sales-row-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const id = Number(checkbox.dataset.id);
            if (checkbox.checked) salesSelectedIds.add(id);
            else salesSelectedIds.delete(id);
            syncSalesCheckboxes();
        });
    });
}

function handleSalesEditSelected() {
    const ids = Array.from(salesSelectedIds);
    if (ids.length !== 1) { showToast('Select exactly one record to edit', 'warning'); return; }
    editSalesRecord(ids[0]);
}

async function handleSalesDeleteSelected() {
    const ids = Array.from(salesSelectedIds);
    if (ids.length === 0) return;
    const confirmed = await showConfirm(`Delete ${ids.length} sales record(s)? This cannot be undone.`);
    if (!confirmed) return;
    salesRecords = salesRecords.filter(r => !salesSelectedIds.has(r.id));
    salesSelectedIds.clear();
    saveSales(salesRecords);
    render();
    updateSummary();
    showToast('Sales records deleted', 'info');
}

