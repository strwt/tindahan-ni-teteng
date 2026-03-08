import './assets/styles/main.css';

// ============================================
// Component Imports
// ============================================
import { initTaxiRentComponent } from './components/TaxiRentComponent.js';
import { initRoomRentComponent } from './components/RoomRentComponent.js';
import { initBorrowComponent }  from './components/BorrowComponent.js';
import { initStoreComponent }   from './components/StoreComponent.js';
import { updateSummary }        from './utils/summary.js';
import { showTab }             from './components/TabNavigation.js';
import { showToast }            from './utils/toast.js';
import './utils/toast.js';
import './utils/confirm.js';
import { exportBorrowRecordsToPdf, exportBorrowerSummaryToPdf } from './utils/exportPdf.js';
import { initLanguageSwitcher } from './utils/language.js';
import { initHeaderThemeSwitcher } from './utils/headerTheme.js';
import { initSyncStatusIndicator, installAutoSync, pullFromBackend, pushToBackend, checkBackendHealth, setStatus, COLLECTION_KEYS, STATUS } from './utils/remoteSync.js';

// ============================================
// Initialize with sample data if empty
// ============================================
function initializeSampleData() {
    const hasRecords = (key) => {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0;
        } catch {
            return false;
        }
    };
    
    // Check if data already has at least one record
    const hasTaxiRent = hasRecords('taxiRentRecords');
    const hasRoomRent = hasRecords('roomRentRecords');
    const hasBorrow = hasRecords('borrowRecords');
    const hasSales = hasRecords('salesRecords');
    const hasExpenses = hasRecords('expenseRecords');
    
    if (!hasTaxiRent) {
        // Add sample taxi rent data
        const today = new Date().toISOString().split('T')[0];
        const sampleTaxiData = [
            {
                id: Date.now() - 1,
                roomName: 'Taxi 001',
                renterName: 'Driver Juan',
                date: today,
                period: 'daily',
                rentAmount: 500,
                paidAmount: 500,
                paymentHistory: [{ id: '1', date: today, amount: 500, note: 'Initial payment' }],
                excepted: false,
                exceptNote: '',
                createdAt: new Date().toISOString()
            },
            {
                id: Date.now() - 2,
                roomName: 'Taxi 002',
                renterName: 'Driver Pedro',
                date: today,
                period: 'daily',
                rentAmount: 500,
                paidAmount: 250,
                paymentHistory: [{ id: '2', date: today, amount: 250, note: 'Initial payment' }],
                excepted: false,
                exceptNote: '',
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('taxiRentRecords', JSON.stringify(sampleTaxiData));
        console.log('Sample taxi rent data initialized');
    }
    
    if (!hasRoomRent) {
        const today = new Date().toISOString().split('T')[0];
        const sampleRoomData = [
            {
                id: Date.now() - 3,
                roomName: 'Room 1',
                renterName: 'Tenant Maria',
                date: today,
                period: 'monthly',
                rentAmount: 3000,
                paidAmount: 1500,
                paymentHistory: [{ id: '3', date: today, amount: 1500, note: 'Initial payment' }],
                excepted: false,
                exceptNote: '',
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('roomRentRecords', JSON.stringify(sampleRoomData));
        console.log('Sample room rent data initialized');
    }
    
    if (!hasBorrow) {
        const today = new Date().toISOString().split('T')[0];
        const sampleBorrowData = [
            {
                id: Date.now() - 4,
                borrower: 'John Doe',
                date: today,
                amount: 5000,
                interestRate: 10,
                installmentMonths: 3,
                dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                totalWithInterest: 6500,
                status: 'pending',
                paidAmount: 0,
                paymentHistory: [],
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('borrowRecords', JSON.stringify(sampleBorrowData));
        console.log('Sample borrow data initialized');
    }
    
    if (!hasSales) {
        const today = new Date().toISOString().split('T')[0];
        const sampleSalesData = [
            {
                id: Date.now() - 5,
                sales: 1500,
                status: 'Daily',
                date: today,
                createdAt: new Date().toISOString()
            },
            {
                id: Date.now() - 6,
                sales: 800,
                status: 'Daily',
                date: today,
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('salesRecords', JSON.stringify(sampleSalesData));
        console.log('Sample sales data initialized');
    }
    
    if (!hasExpenses) {
        const today = new Date().toISOString().split('T')[0];
        const sampleExpenseData = [
            {
                id: Date.now() - 7,
                name: 'Rice',
                category: 'Store Grocery',
                date: today,
                amount: 500,
                createdAt: new Date().toISOString()
            },
            {
                id: Date.now() - 8,
                name: 'Water Bill',
                category: 'Utilities',
                date: today,
                amount: 300,
                createdAt: new Date().toISOString()
            }
        ];
        localStorage.setItem('expenseRecords', JSON.stringify(sampleExpenseData));
        console.log('Sample expense data initialized');
    }
}


async function bootstrapApp() {
    initSyncStatusIndicator();
    
    // First check if we have existing local data
    const hasLocalData = COLLECTION_KEYS.some(key => {
        const data = localStorage.getItem(key);
        return data && JSON.parse(data).length > 0;
    });
    
    // Pull from backend only if no local data exists
    if (!hasLocalData) {
        await pullFromBackend();
    } else {
        console.log('[Bootstrap] Local data exists, skipping pull');
        // Still check health but don't overwrite local data
        const health = await checkBackendHealth();
        if (health?.supabaseConfigured && health?.connectionTest?.ok) {
            setStatus(STATUS.SYNCED);
        }
    }
    
    initializeSampleData();
    installAutoSync();
    initLanguageSwitcher();
    initHeaderThemeSwitcher();
    initTaxiRentComponent();
    initRoomRentComponent();
    initBorrowComponent();
    initStoreComponent();
    updateSummary();
    await pushToBackend();
}

bootstrapApp();

// Make showTab available globally
window.showTab = showTab;

// Add borrow PDF export functionality
document.addEventListener('DOMContentLoaded', () => {
    // Borrow export PDF
    const borrowExportPdf = document.getElementById('borrow-export-pdf');
    if (borrowExportPdf) {
        borrowExportPdf.addEventListener('click', () => {
            const records = JSON.parse(localStorage.getItem('borrowRecords') || '[]');
            if (records.length === 0) {
                showToast('No records to export', 'warning');
                return;
            }
            
            // Transform records for export
            const exportRecords = records.map(r => ({
                ...r,
                remainingBalance: (r.totalWithInterest || 0) - (r.paidAmount || 0)
            }));
            
            const success = exportBorrowRecordsToPdf({
                title: 'Borrow Records Report',
                subtitle: 'Money Owed to You',
                records: exportRecords,
                filename: 'borrow-records'
            });
            
            if (success) {
                showToast('PDF exported successfully', 'success');
            } else {
                showToast('Failed to export PDF', 'error');
            }
        });
    }

    // Borrow summary export PDF
    const borrowSummaryExportPdf = document.getElementById('borrow-summary-export-pdf');
    if (borrowSummaryExportPdf) {
        borrowSummaryExportPdf.addEventListener('click', () => {
            const select = document.getElementById('borrow-summary-borrower');
            if (!select || !select.value) {
                showToast('Please select a borrower first', 'warning');
                return;
            }
            
            const borrowerName = select.value;
            const records = JSON.parse(localStorage.getItem('borrowRecords') || '[]');
            const borrowerRecords = records.filter(r => r.borrower === borrowerName);
            
            if (borrowerRecords.length === 0) {
                showToast('No records for this borrower', 'warning');
                return;
            }
            
            const totalBorrowed = borrowerRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
            const totalWithInterest = borrowerRecords.reduce((sum, r) => sum + (r.totalWithInterest || 0), 0);
            const totalPaid = borrowerRecords.reduce((sum, r) => sum + (r.paidAmount || 0), 0);
            const remainingBalance = totalWithInterest - totalPaid;
            
            // Flatten payment history
            const transactions = borrowerRecords.flatMap(record => {
                if (!Array.isArray(record.paymentHistory) || record.paymentHistory.length === 0) {
                    return [];
                }
                return record.paymentHistory.map(history => ({
                    date: history.date || record.date,
                    amount: history.amount,
                    note: history.note || 'Payment'
                }));
            }).sort((a, b) => new Date(b.date) - new Date(a.date));
            
            const success = exportBorrowerSummaryToPdf({
                title: 'Borrower Summary Report',
                borrowerName,
                totalBorrowed,
                totalWithInterest,
                totalPaid,
                remainingBalance,
                transactions,
                filename: `borrow-summary-${borrowerName}`
            });
            
            if (success) {
                showToast('PDF exported successfully', 'success');
            } else {
                showToast('Failed to export PDF', 'error');
            }
        });
    }
});

console.log('Rent Money and Sari-Sari Store ready!');
