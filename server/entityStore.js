const COLLECTIONS = {
    taxiRentRecords: 'taxiRentRecords',
    roomRentRecords: 'roomRentRecords',
    borrowRecords: 'borrowRecords',
    salesRecords: 'salesRecords',
    expenseRecords: 'expenseRecords',
};

const COLLECTION_KEYS = Object.values(COLLECTIONS);

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback = 0) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeDate(dateString) {
    if (!dateString) return new Date().toISOString().slice(0, 10);
    return String(dateString).slice(0, 10);
}

function maxUpdatedAt(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows.reduce((latest, row) => {
        if (!row?.updated_at) return latest;
        if (!latest) return row.updated_at;
        return row.updated_at > latest ? row.updated_at : latest;
    }, null);
}

async function getTaxiRentRecords(supabase) {
    const { data: records, error: recordsError } = await supabase
        .from('taxi_rent_records')
        .select('*')
        .order('record_date', { ascending: false });
    if (recordsError) throw new Error(recordsError.message);

    const ids = (records || []).map((r) => r.id);
    let payments = [];
    if (ids.length > 0) {
        const result = await supabase
            .from('taxi_rent_payments')
            .select('*')
            .in('rent_record_id', ids);
        if (result.error) throw new Error(result.error.message);
        payments = result.data || [];
    }

    const paymentMap = payments.reduce((acc, p) => {
        if (!acc[p.rent_record_id]) acc[p.rent_record_id] = [];
        acc[p.rent_record_id].push({
            id: p.id,
            date: p.payment_date,
            amount: toNumber(p.amount),
            note: p.note || '',
        });
        return acc;
    }, {});

    return {
        data: (records || []).map((r) => ({
            id: r.id,
            roomName: r.room_name,
            renterName: r.renter_name,
            date: r.record_date,
            period: r.period,
            rentAmount: toNumber(r.rent_amount),
            paidAmount: toNumber(r.paid_amount),
            excepted: !!r.excepted,
            exceptNote: r.except_note || '',
            paymentHistory: paymentMap[r.id] || [],
            createdAt: r.created_at,
        })),
        updatedAt: maxUpdatedAt(records),
    };
}

async function setTaxiRentRecords(supabase, collectionData) {
    const records = Array.isArray(collectionData) ? collectionData : [];
    const normalized = records.map((r) => ({
        id: toInt(r.id),
        room_name: String(r.roomName || ''),
        renter_name: String(r.renterName || ''),
        record_date: normalizeDate(r.date),
        period: ['daily', 'weekly', 'monthly'].includes(r.period) ? r.period : 'daily',
        rent_amount: toNumber(r.rentAmount),
        paid_amount: toNumber(r.paidAmount),
        excepted: !!r.excepted,
        except_note: String(r.exceptNote || ''),
    })).filter((r) => r.id > 0);

    const ids = normalized.map((r) => r.id);

    if (normalized.length > 0) {
        const upsert = await supabase.from('taxi_rent_records').upsert(normalized, { onConflict: 'id' });
        if (upsert.error) throw new Error(upsert.error.message);
    }

    if (ids.length > 0) {
        const delMissing = await supabase.from('taxi_rent_records').delete().not('id', 'in', `(${ids.join(',')})`);
        if (delMissing.error) throw new Error(delMissing.error.message);
    } else {
        const delAll = await supabase.from('taxi_rent_records').delete().neq('id', -1);
        if (delAll.error) throw new Error(delAll.error.message);
    }

    if (ids.length > 0) {
        // Delete old payments first
        const delPayments = await supabase.from('taxi_rent_payments').delete().in('rent_record_id', ids);
        if (delPayments.error) throw new Error(delPayments.error.message);

        // Generate payment rows with unique IDs
        const paymentRows = records.flatMap((record) => {
            const recordId = toInt(record.id);
            if (!recordId || !Array.isArray(record.paymentHistory)) return [];
            return record.paymentHistory.map((h) => ({
                id: String(h.id || `${recordId}-${normalizeDate(h.date)}-${Math.random().toString(36).slice(2)}`).slice(0, 255),
                rent_record_id: recordId,
                payment_date: normalizeDate(h.date || record.date),
                amount: toNumber(h.amount),
                note: String(h.note || ''),
            }));
        });

        if (paymentRows.length > 0) {
            // Use upsert instead of insert to handle duplicates
            const upsertPayments = await supabase.from('taxi_rent_payments').upsert(paymentRows, { onConflict: 'id' });
            if (upsertPayments.error) {
                console.error('[TaxiRent] Payment upsert error:', upsertPayments.error);
                // Try insert one by one to find the problematic record
                for (const payment of paymentRows) {
                    const result = await supabase.from('taxi_rent_payments').upsert([payment], { onConflict: 'id' });
                    if (result.error) {
                        console.error('[TaxiRent] Failed payment:', payment, result.error);
                        throw new Error(result.error.message);
                    }
                }
            }
        }
    }

    return getTaxiRentRecords(supabase);
}

async function getRoomRentRecords(supabase) {
    const { data: records, error: recordsError } = await supabase
        .from('room_rent_records')
        .select('*')
        .order('record_date', { ascending: false });
    if (recordsError) throw new Error(recordsError.message);

    const ids = (records || []).map((r) => r.id);
    let payments = [];
    if (ids.length > 0) {
        const result = await supabase
            .from('room_rent_payments')
            .select('*')
            .in('rent_record_id', ids);
        if (result.error) throw new Error(result.error.message);
        payments = result.data || [];
    }

    const paymentMap = payments.reduce((acc, p) => {
        if (!acc[p.rent_record_id]) acc[p.rent_record_id] = [];
        acc[p.rent_record_id].push({
            id: p.id,
            date: p.payment_date,
            amount: toNumber(p.amount),
            note: p.note || '',
        });
        return acc;
    }, {});

    return {
        data: (records || []).map((r) => ({
            id: r.id,
            roomName: r.room_name,
            renterName: r.renter_name,
            date: r.record_date,
            period: r.period,
            rentAmount: toNumber(r.rent_amount),
            paidAmount: toNumber(r.paid_amount),
            excepted: !!r.excepted,
            exceptNote: r.except_note || '',
            paymentHistory: paymentMap[r.id] || [],
            createdAt: r.created_at,
        })),
        updatedAt: maxUpdatedAt(records),
    };
}

async function setRoomRentRecords(supabase, collectionData) {
    const records = Array.isArray(collectionData) ? collectionData : [];
    const normalized = records.map((r) => ({
        id: toInt(r.id),
        room_name: String(r.roomName || ''),
        renter_name: String(r.renterName || ''),
        record_date: normalizeDate(r.date),
        period: ['weekly', 'monthly'].includes(r.period) ? r.period : 'weekly',
        rent_amount: toNumber(r.rentAmount),
        paid_amount: toNumber(r.paidAmount),
        excepted: !!r.excepted,
        except_note: String(r.exceptNote || ''),
    })).filter((r) => r.id > 0);

    const ids = normalized.map((r) => r.id);

    if (normalized.length > 0) {
        const upsert = await supabase.from('room_rent_records').upsert(normalized, { onConflict: 'id' });
        if (upsert.error) throw new Error(upsert.error.message);
    }

    if (ids.length > 0) {
        const delMissing = await supabase.from('room_rent_records').delete().not('id', 'in', `(${ids.join(',')})`);
        if (delMissing.error) throw new Error(delMissing.error.message);
    } else {
        const delAll = await supabase.from('room_rent_records').delete().neq('id', -1);
        if (delAll.error) throw new Error(delAll.error.message);
    }

    if (ids.length > 0) {
        // Delete old payments first
        const delPayments = await supabase.from('room_rent_payments').delete().in('rent_record_id', ids);
        if (delPayments.error) throw new Error(delPayments.error.message);

        // Generate payment rows with unique IDs
        const paymentRows = records.flatMap((record) => {
            const recordId = toInt(record.id);
            if (!recordId || !Array.isArray(record.paymentHistory)) return [];
            return record.paymentHistory.map((h) => ({
                id: String(h.id || `${recordId}-${normalizeDate(h.date)}-${Math.random().toString(36).slice(2)}`).slice(0, 255),
                rent_record_id: recordId,
                payment_date: normalizeDate(h.date || record.date),
                amount: toNumber(h.amount),
                note: String(h.note || ''),
            }));
        });

        if (paymentRows.length > 0) {
            // Use upsert instead of insert to handle duplicates
            const upsertPayments = await supabase.from('room_rent_payments').upsert(paymentRows, { onConflict: 'id' });
            if (upsertPayments.error) {
                console.error('[RoomRent] Payment upsert error:', upsertPayments.error);
                // Try one by one
                for (const payment of paymentRows) {
                    const result = await supabase.from('room_rent_payments').upsert([payment], { onConflict: 'id' });
                    if (result.error) {
                        console.error('[RoomRent] Failed payment:', payment, result.error);
                        throw new Error(result.error.message);
                    }
                }
            }
        }
    }

    return getRoomRentRecords(supabase);
}

async function getBorrowRecords(supabase) {
    const { data: records, error: recordsError } = await supabase
        .from('borrow_records')
        .select('*')
        .order('record_date', { ascending: false });
    if (recordsError) throw new Error(recordsError.message);

    const ids = (records || []).map((r) => r.id);
    let payments = [];
    if (ids.length > 0) {
        const result = await supabase
            .from('borrow_payments')
            .select('*')
            .in('borrow_record_id', ids);
        if (result.error) throw new Error(result.error.message);
        payments = result.data || [];
    }

    const paymentMap = payments.reduce((acc, p) => {
        if (!acc[p.borrow_record_id]) acc[p.borrow_record_id] = [];
        acc[p.borrow_record_id].push({
            id: p.id,
            date: p.payment_date,
            amount: toNumber(p.amount),
            note: p.note || '',
        });
        return acc;
    }, {});

    return {
        data: (records || []).map((r) => ({
            id: r.id,
            borrower: r.borrower,
            date: r.record_date,
            amount: toNumber(r.amount),
            interestRate: toNumber(r.interest_rate),
            installmentMonths: toInt(r.installment_months),
            dueDate: r.due_date,
            totalWithInterest: toNumber(r.total_with_interest),
            status: r.status || 'pending',
            paidAmount: toNumber(r.paid_amount),
            paymentHistory: paymentMap[r.id] || [],
            createdAt: r.created_at,
        })),
        updatedAt: maxUpdatedAt(records),
    };
}

async function setBorrowRecords(supabase, collectionData) {
    const records = Array.isArray(collectionData) ? collectionData : [];
    const normalized = records.map((r) => ({
        id: toInt(r.id),
        borrower: String(r.borrower || ''),
        record_date: normalizeDate(r.date),
        amount: toNumber(r.amount),
        interest_rate: toNumber(r.interestRate),
        installment_months: toInt(r.installmentMonths),
        due_date: r.dueDate ? normalizeDate(r.dueDate) : null,
        total_with_interest: toNumber(r.totalWithInterest),
        status: r.status === 'paid' ? 'paid' : 'pending',
        paid_amount: toNumber(r.paidAmount),
    })).filter((r) => r.id > 0);

    const ids = normalized.map((r) => r.id);

    if (normalized.length > 0) {
        const upsert = await supabase.from('borrow_records').upsert(normalized, { onConflict: 'id' });
        if (upsert.error) throw new Error(upsert.error.message);
    }

    if (ids.length > 0) {
        const delMissing = await supabase.from('borrow_records').delete().not('id', 'in', `(${ids.join(',')})`);
        if (delMissing.error) throw new Error(delMissing.error.message);
    } else {
        const delAll = await supabase.from('borrow_records').delete().neq('id', -1);
        if (delAll.error) throw new Error(delAll.error.message);
    }

    if (ids.length > 0) {
        // Delete old payments first
        const delPayments = await supabase.from('borrow_payments').delete().in('borrow_record_id', ids);
        if (delPayments.error) throw new Error(delPayments.error.message);

        // Generate payment rows with unique IDs
        const paymentRows = records.flatMap((record) => {
            const recordId = toInt(record.id);
            if (!recordId || !Array.isArray(record.paymentHistory)) return [];
            return record.paymentHistory.map((h) => ({
                id: String(h.id || `${recordId}-${normalizeDate(h.date)}-${Math.random().toString(36).slice(2)}`).slice(0, 255),
                borrow_record_id: recordId,
                payment_date: normalizeDate(h.date || record.date),
                amount: toNumber(h.amount),
                note: String(h.note || ''),
            }));
        });

        if (paymentRows.length > 0) {
            // Use upsert instead of insert to handle duplicates
            const upsertPayments = await supabase.from('borrow_payments').upsert(paymentRows, { onConflict: 'id' });
            if (upsertPayments.error) {
                console.error('[Borrow] Payment upsert error:', upsertPayments.error);
                // Try one by one
                for (const payment of paymentRows) {
                    const result = await supabase.from('borrow_payments').upsert([payment], { onConflict: 'id' });
                    if (result.error) {
                        console.error('[Borrow] Failed payment:', payment, result.error);
                        throw new Error(result.error.message);
                    }
                }
            }
        }
    }

    return getBorrowRecords(supabase);
}

async function getSalesRecords(supabase) {
    const { data, error } = await supabase
        .from('sales_records')
        .select('*')
        .order('record_date', { ascending: false });
    if (error) throw new Error(error.message);

    return {
        data: (data || []).map((r) => ({
            id: r.id,
            sales: toNumber(r.sales),
            status: r.status,
            date: r.record_date,
            createdAt: r.created_at,
        })),
        updatedAt: maxUpdatedAt(data),
    };
}

async function setSalesRecords(supabase, collectionData) {
    const records = Array.isArray(collectionData) ? collectionData : [];
    const normalized = records.map((r) => ({
        id: toInt(r.id),
        sales: toNumber(r.sales),
        status: ['Daily', 'Weekly', 'Monthly'].includes(r.status) ? r.status : 'Daily',
        record_date: normalizeDate(r.date),
    })).filter((r) => r.id > 0);

    const ids = normalized.map((r) => r.id);
    if (normalized.length > 0) {
        const upsert = await supabase.from('sales_records').upsert(normalized, { onConflict: 'id' });
        if (upsert.error) throw new Error(upsert.error.message);
    }
    if (ids.length > 0) {
        const delMissing = await supabase.from('sales_records').delete().not('id', 'in', `(${ids.join(',')})`);
        if (delMissing.error) throw new Error(delMissing.error.message);
    } else {
        const delAll = await supabase.from('sales_records').delete().neq('id', -1);
        if (delAll.error) throw new Error(delAll.error.message);
    }

    return getSalesRecords(supabase);
}

async function getExpenseRecords(supabase) {
    const { data, error } = await supabase
        .from('expense_records')
        .select('*')
        .order('record_date', { ascending: false });
    if (error) throw new Error(error.message);

    return {
        data: (data || []).map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            date: r.record_date,
            amount: toNumber(r.amount),
            createdAt: r.created_at,
        })),
        updatedAt: maxUpdatedAt(data),
    };
}

async function setExpenseRecords(supabase, collectionData) {
    const records = Array.isArray(collectionData) ? collectionData : [];
    const normalized = records.map((r) => ({
        id: toInt(r.id),
        name: String(r.name || ''),
        category: String(r.category || 'Store Grocery'),
        record_date: normalizeDate(r.date),
        amount: toNumber(r.amount),
    })).filter((r) => r.id > 0);

    const ids = normalized.map((r) => r.id);
    if (normalized.length > 0) {
        const upsert = await supabase.from('expense_records').upsert(normalized, { onConflict: 'id' });
        if (upsert.error) throw new Error(upsert.error.message);
    }
    if (ids.length > 0) {
        const delMissing = await supabase.from('expense_records').delete().not('id', 'in', `(${ids.join(',')})`);
        if (delMissing.error) throw new Error(delMissing.error.message);
    } else {
        const delAll = await supabase.from('expense_records').delete().neq('id', -1);
        if (delAll.error) throw new Error(delAll.error.message);
    }

    return getExpenseRecords(supabase);
}

const getters = {
    [COLLECTIONS.taxiRentRecords]: getTaxiRentRecords,
    [COLLECTIONS.roomRentRecords]: getRoomRentRecords,
    [COLLECTIONS.borrowRecords]: getBorrowRecords,
    [COLLECTIONS.salesRecords]: getSalesRecords,
    [COLLECTIONS.expenseRecords]: getExpenseRecords,
};

const setters = {
    [COLLECTIONS.taxiRentRecords]: setTaxiRentRecords,
    [COLLECTIONS.roomRentRecords]: setRoomRentRecords,
    [COLLECTIONS.borrowRecords]: setBorrowRecords,
    [COLLECTIONS.salesRecords]: setSalesRecords,
    [COLLECTIONS.expenseRecords]: setExpenseRecords,
};

async function getCollection(supabase, name) {
    if (!getters[name]) throw new Error(`Unsupported collection: ${name}`);
    return getters[name](supabase);
}

async function setCollection(supabase, name, data) {
    if (!setters[name]) throw new Error(`Unsupported collection: ${name}`);
    return setters[name](supabase, data);
}

module.exports = {
    COLLECTION_KEYS,
    getCollection,
    setCollection,
};

