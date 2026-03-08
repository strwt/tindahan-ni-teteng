// ============================================
// Header Summary Stats Updater
// ============================================

export function updateSummary() {
    const taxiRentRecords = JSON.parse(localStorage.getItem('taxiRentRecords') || '[]');
    const roomRentRecords = JSON.parse(localStorage.getItem('roomRentRecords') || '[]');
    const borrowRecords = JSON.parse(localStorage.getItem('borrowRecords') || '[]');
    const salesRecords = JSON.parse(localStorage.getItem('salesRecords') || '[]');
    const expenseRecords = JSON.parse(localStorage.getItem('expenseRecords') || '[]');

    const taxiRentTotal = taxiRentRecords.reduce((s, r) => {
        const paidAmount = Number(r.paidAmount ?? r.amount ?? 0);
        return s + paidAmount;
    }, 0);

    const roomRentTotal = roomRentRecords.reduce((s, r) => {
        const paidAmount = Number(r.paidAmount ?? r.amount ?? 0);
        return s + paidAmount;
    }, 0);

    const borrowPending = borrowRecords
        .filter(r => r.status === 'pending')
        .reduce((s, r) => {
            const totalWithInterest = Number(r.totalWithInterest ?? r.amount ?? 0);
            const paidAmount = Number(r.paidAmount ?? 0);
            return s + Math.max(0, totalWithInterest - paidAmount);
        }, 0);


    const totalSales = salesRecords.reduce((s, r) => s + r.sales, 0);
    const totalExpenses = expenseRecords.reduce((s, r) => s + r.amount, 0);
    const storeProfit = totalSales - totalExpenses;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '₱' + val.toFixed(2);
    };

    set('summary-rent', taxiRentTotal);
    set('summary-room', roomRentTotal);
    set('summary-borrow', borrowPending);
    set('summary-store', storeProfit);
}

