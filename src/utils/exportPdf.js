
function toAscii(text) {
    return String(text ?? '').replace(/[^\x20-\x7E]/g, '?');
}

function escapePdfText(text) {
    return toAscii(text)
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatMoney(value) {
    return `PHP ${Number(value || 0).toFixed(2)}`;
}

function makeFilename(name) {
    const safe = toAscii(name).replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
    return (safe || 'report') + '.pdf';
}

function padRight(value, width) {
    const text = toAscii(value);
    if (text.length >= width) return text.slice(0, width);
    return text + ' '.repeat(width - text.length);
}

function padLeft(value, width) {
    const text = toAscii(value);
    if (text.length >= width) return text.slice(0, width);
    return ' '.repeat(width - text.length) + text;
}

function wrapText(value, width) {
    const text = toAscii(value ?? '');
    if (!text) return [''];
    if (text.length <= width) return [text];

    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let current = '';

    words.forEach((word) => {
        if (word.length > width) {
            if (current) {
                lines.push(current);
                current = '';
            }
            for (let i = 0; i < word.length; i += width) {
                lines.push(word.slice(i, i + width));
            }
            return;
        }

        if (!current) {
            current = word;
            return;
        }

        const next = `${current} ${word}`;
        if (next.length <= width) {
            current = next;
        } else {
            lines.push(current);
            current = word;
        }
    });

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [''];
}

function paginateLines(lines, linesPerPage = 56) {
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) {
        pages.push(lines.slice(i, i + linesPerPage));
    }
    return pages.length > 0 ? pages : [['No records to export.']];
}

function getPaymentStatus(record) {
    const rentAmount = Number(record.rentAmount || 0);
    const paidAmount = Number(record.paidAmount || 0);
    const kulang = Math.max(0, rentAmount - paidAmount);
    if (kulang <= 0) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL';
    return 'UNPAID';
}

function buildReportLines({ title, subtitle, records, generatedAt }) {
    const COL = {
        index: 3,
        item: 10,
        renter: 10,
        date: 11,
        cycle: 6,
        rent: 12,
        paid: 12,
        kulang: 12,
        status: 7,
    };

    const totalRent = records.reduce((sum, r) => sum + Number(r.rentAmount || 0), 0);
    const totalPaid = records.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
    const totalKulang = records.reduce((sum, r) => sum + Math.max(0, Number(r.rentAmount || 0) - Number(r.paidAmount || 0)), 0);

    const lines = [];
    lines.push(title);
    if (subtitle) lines.push(subtitle);
    lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
    lines.push('');
    lines.push(`Total Rent: ${formatMoney(totalRent)}   Total Paid: ${formatMoney(totalPaid)}   Total Kulang: ${formatMoney(totalKulang)}`);
    lines.push('');

    const header =
        `${padRight('#', COL.index)} ` +
        `${padRight('Item', COL.item)} ` +
        `${padRight('Renter', COL.renter)} ` +
        `${padRight('Date', COL.date)} ` +
        `${padRight('Cycle', COL.cycle)} ` +
        `${padLeft('Rent', COL.rent)} ` +
        `${padLeft('Paid', COL.paid)} ` +
        `${padLeft('Kulang', COL.kulang)} ` +
        `${padRight('Status', COL.status)}`;
    lines.push(header);
    lines.push('-'.repeat(header.length));

    if (records.length === 0) {
        lines.push('No records to export.');
        return lines;
    }

    records.forEach((record, idx) => {
        const rentAmount = Number(record.rentAmount || 0);
        const paidAmount = Number(record.paidAmount || 0);
        const kulang = Math.max(0, rentAmount - paidAmount);
        const status = getPaymentStatus(record);

        const itemLines = wrapText(record.roomName || '-', COL.item);
        const renterLines = wrapText(record.renterName || '-', COL.renter);
        const dateLines = wrapText(formatDate(record.date), COL.date);
        const cycleLines = wrapText(record.period || '-', COL.cycle);
        const statusLines = wrapText(status, COL.status);
        const rowHeight = Math.max(itemLines.length, renterLines.length, dateLines.length, cycleLines.length, statusLines.length);

        for (let row = 0; row < rowHeight; row += 1) {
            lines.push(
                `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                `${padRight(itemLines[row] || '', COL.item)} ` +
                `${padRight(renterLines[row] || '', COL.renter)} ` +
                `${padRight(dateLines[row] || '', COL.date)} ` +
                `${padRight(cycleLines[row] || '', COL.cycle)} ` +
                `${padLeft(row === 0 ? formatMoney(rentAmount) : '', COL.rent)} ` +
                `${padLeft(row === 0 ? formatMoney(paidAmount) : '', COL.paid)} ` +
                `${padLeft(row === 0 ? formatMoney(kulang) : '', COL.kulang)} ` +
                `${padRight(statusLines[row] || '', COL.status)}`
            );
        }
    });

    return lines;
}

function buildStatusBreakdownLines({ title, records, generatedAt }) {
    const COL = {
        index: 3,
        renter: 14,
        item: 12,
        cycle: 6,
        rent: 12,
        paid: 12,
        kulang: 12,
    };

    const groups = {
        PAID: [],
        PARTIAL: [],
        UNPAID: [],
    };
    records.forEach((record) => {
        groups[getPaymentStatus(record)].push(record);
    });

    const lines = [];
    lines.push(`${title} - Payment Status Breakdown`);
    lines.push('Categories: PAID | NAA PAY KULANG (PARTIAL) | WALA PA KABAYAD (UNPAID)');
    lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
    lines.push('');
    lines.push(`PAID: ${groups.PAID.length}   PARTIAL: ${groups.PARTIAL.length}   UNPAID: ${groups.UNPAID.length}`);
    lines.push('');

    const appendGroup = (label, displayName, items) => {
        lines.push(`[${label}] ${displayName}`);
        const header =
            `${padRight('#', COL.index)} ` +
            `${padRight('Renter', COL.renter)} ` +
            `${padRight('Item', COL.item)} ` +
            `${padRight('Cycle', COL.cycle)} ` +
            `${padLeft('Rent', COL.rent)} ` +
            `${padLeft('Paid', COL.paid)} ` +
            `${padLeft('Kulang', COL.kulang)}`;
        lines.push(header);
        lines.push('-'.repeat(header.length));

        if (items.length === 0) {
            lines.push('No records in this category.');
            lines.push('');
            return;
        }

        items.forEach((record, idx) => {
            const rentAmount = Number(record.rentAmount || 0);
            const paidAmount = Number(record.paidAmount || 0);
            const kulang = Math.max(0, rentAmount - paidAmount);

            const renterLines = wrapText(record.renterName || '-', COL.renter);
            const itemLines = wrapText(record.roomName || '-', COL.item);
            const cycleLines = wrapText(record.period || '-', COL.cycle);
            const rowHeight = Math.max(renterLines.length, itemLines.length, cycleLines.length);

            for (let row = 0; row < rowHeight; row += 1) {
                lines.push(
                    `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                    `${padRight(renterLines[row] || '', COL.renter)} ` +
                    `${padRight(itemLines[row] || '', COL.item)} ` +
                    `${padRight(cycleLines[row] || '', COL.cycle)} ` +
                    `${padLeft(row === 0 ? formatMoney(rentAmount) : '', COL.rent)} ` +
                    `${padLeft(row === 0 ? formatMoney(paidAmount) : '', COL.paid)} ` +
                    `${padLeft(row === 0 ? formatMoney(kulang) : '', COL.kulang)}`
                );
            }
        });

        lines.push('');
    };

    appendGroup('PAID', 'Already Paid', groups.PAID);
    appendGroup('PARTIAL', 'Naa Pay Kulang', groups.PARTIAL);
    appendGroup('UNPAID', 'Wala Pa Kabayad', groups.UNPAID);

    return lines;
}

function buildPdf(pages) {
    const objects = [];

    const addObject = (body) => {
        objects.push(body);
        return objects.length;
    };

    const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
    const pagesId = addObject('<< /Type /Pages /Count 0 /Kids [] >>');
    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

    const pageIds = [];
    const contentIds = [];

    pages.forEach((pageLines) => {
        const streamLines = [];
        streamLines.push('BT');
        streamLines.push('/F1 9 Tf');
        streamLines.push('12 TL');
        streamLines.push('36 806 Td');
        pageLines.forEach((line, idx) => {
            if (idx === 0) {
                streamLines.push('0 g');
                streamLines.push(`/F1 11 Tf (${escapePdfText(line)}) Tj`);
                streamLines.push('/F1 9 Tf');
            } else {
                streamLines.push('T*');
                streamLines.push(`(${escapePdfText(line)}) Tj`);
            }
        });
        streamLines.push('ET');

        const streamContent = streamLines.join('\n');
        const contentBody = `<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream`;
        const contentId = addObject(contentBody);
        contentIds.push(contentId);

        const pageBody = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
        const pageId = addObject(pageBody);
        pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];

    objects.forEach((body, idx) => {
        offsets.push(pdf.length);
        pdf += `${idx + 1} 0 obj\n${body}\nendobj\n`;
    });

    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
        pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
    pdf += `startxref\n${xrefOffset}\n%%EOF`;

    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i += 1) {
        bytes[i] = pdf.charCodeAt(i) & 0xff;
    }
    return bytes;
}

export function exportRentRecordsToPdf({
    title,
    subtitle = '',
    records,
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const reportLines = buildReportLines({ title, subtitle, records, generatedAt });
        const statusLines = buildStatusBreakdownLines({ title, records, generatedAt });
        const pages = [...paginateLines(reportLines, 56), ...paginateLines(statusLines, 56)];

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'rent-report');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

export function exportRenterSummaryToPdf({
    title,
    subtitle = '',
    weeklyRent = 0,
    overallPaid = 0,
    remainingBalance = 0,
    transactions = [],
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const COL = {
            index: 3,
            date: 11,
            item: 12,
            cycle: 6,
            type: 8,
            amount: 12,
            note: 18,
        };

        const lines = [];
        lines.push(title);
        if (subtitle) lines.push(subtitle);
        lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
        lines.push('');
        lines.push(`Abang within week: ${formatMoney(weeklyRent)}   Overall Paid: ${formatMoney(overallPaid)}   Remaining: ${formatMoney(remainingBalance)}`);
        lines.push('');

        const header =
            `${padRight('#', COL.index)} ` +
            `${padRight('Date', COL.date)} ` +
            `${padRight('Item', COL.item)} ` +
            `${padRight('Cycle', COL.cycle)} ` +
            `${padRight('Type', COL.type)} ` +
            `${padLeft('Amount', COL.amount)} ` +
            `${padRight('Note', COL.note)}`;
        lines.push(header);
        lines.push('-'.repeat(header.length));

        if (transactions.length === 0) {
            lines.push('No transactions to export.');
        } else {
            transactions.forEach((tx, idx) => {
                const dateLines = wrapText(formatDate(tx.date), COL.date);
                const itemLines = wrapText(tx.item || '-', COL.item);
                const cycleLines = wrapText(tx.period || '-', COL.cycle);
                const typeLines = wrapText(tx.type || '-', COL.type);
                const noteLines = wrapText(tx.note || '-', COL.note);
                const rowHeight = Math.max(dateLines.length, itemLines.length, cycleLines.length, typeLines.length, noteLines.length);

                for (let row = 0; row < rowHeight; row += 1) {
                    lines.push(
                        `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                        `${padRight(dateLines[row] || '', COL.date)} ` +
                        `${padRight(itemLines[row] || '', COL.item)} ` +
                        `${padRight(cycleLines[row] || '', COL.cycle)} ` +
                        `${padRight(typeLines[row] || '', COL.type)} ` +
                        `${padLeft(row === 0 ? formatMoney(tx.amount || 0) : '', COL.amount)} ` +
                        `${padRight(noteLines[row] || '', COL.note)}`
                    );
                }
            });
        }

        const pages = paginateLines(lines, 56);

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'rent-report');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

// ========== BORROW PDF EXPORT FUNCTIONS ==========

function getBorrowStatus(record) {
    const remaining = (record.totalWithInterest || 0) - (record.paidAmount || 0);
    if (record.status === 'paid' || remaining <= 0) return 'PAID';
    return 'OWING';
}

function buildBorrowReportLines({ title, subtitle, records, generatedAt }) {
    const COL = {
        index: 3,
        name: 12,
        date: 11,
        dueDate: 11,
        interest: 10,
        amount: 12,
        remaining: 12,
        status: 7,
    };

    const totalOriginal = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalWithInterest = records.reduce((sum, r) => sum + Number(r.totalWithInterest || 0), 0);
    const totalRemaining = records.filter(r => r.status === 'pending').reduce((sum, r) => {
        const totalWithInterest = Number(r.totalWithInterest || 0);
        const paidAmount = Number(r.paidAmount || 0);
        return sum + Math.max(0, totalWithInterest - paidAmount);
    }, 0);

    const lines = [];
    lines.push(title);
    if (subtitle) lines.push(subtitle);
    lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
    lines.push('');
    lines.push(`Total Original: ${formatMoney(totalOriginal)}   Total with Interest: ${formatMoney(totalWithInterest)}   Remaining: ${formatMoney(totalRemaining)}`);
    lines.push('');

    const header =
        `${padRight('#', COL.index)} ` +
        `${padRight('Name', COL.name)} ` +
        `${padRight('Date', COL.date)} ` +
        `${padRight('Due Date', COL.dueDate)} ` +
        `${padRight('Interest', COL.interest)} ` +
        `${padLeft('Amount', COL.amount)} ` +
        `${padLeft('Remaining', COL.remaining)} ` +
        `${padRight('Status', COL.status)}`;
    lines.push(header);
    lines.push('-'.repeat(header.length));

    if (records.length === 0) {
        lines.push('No records to export.');
        return lines;
    }

    records.forEach((record, idx) => {
        const amount = Number(record.amount || 0);
        const interestRate = Number(record.interestRate || 0);
        const installmentMonths = Number(record.installmentMonths || 0);
        const remaining = (Number(record.totalWithInterest || 0)) - (Number(record.paidAmount || 0));
        const status = getBorrowStatus(record);

        let interestDisplay = '-';
        if (interestRate > 0 && installmentMonths > 0) {
            interestDisplay = `${interestRate}%/${installmentMonths}mo`;
        }

        const nameLines = wrapText(record.borrower || '-', COL.name);
        const dateLines = wrapText(formatDate(record.date), COL.date);
        const dueDateLines = wrapText(record.dueDate ? formatDate(record.dueDate) : '-', COL.dueDate);
        const interestLines = wrapText(interestDisplay, COL.interest);
        const statusLines = wrapText(status, COL.status);
        const rowHeight = Math.max(nameLines.length, dateLines.length, dueDateLines.length, interestLines.length, statusLines.length);

        for (let row = 0; row < rowHeight; row += 1) {
            lines.push(
                `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                `${padRight(nameLines[row] || '', COL.name)} ` +
                `${padRight(dateLines[row] || '', COL.date)} ` +
                `${padRight(dueDateLines[row] || '', COL.dueDate)} ` +
                `${padRight(interestLines[row] || '', COL.interest)} ` +
                `${padLeft(row === 0 ? formatMoney(amount) : '', COL.amount)} ` +
                `${padLeft(row === 0 ? formatMoney(remaining) : '', COL.remaining)} ` +
                `${padRight(statusLines[row] || '', COL.status)}`
            );
        }
    });

    return lines;
}

export function exportBorrowRecordsToPdf({
    title,
    subtitle = '',
    records,
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const reportLines = buildBorrowReportLines({ title, subtitle, records, generatedAt });
        const pages = paginateLines(reportLines, 56);

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'borrow-report');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

export function exportBorrowerSummaryToPdf({
    title,
    borrowerName = '',
    totalBorrowed = 0,
    totalWithInterest = 0,
    totalPaid = 0,
    remainingBalance = 0,
    transactions = [],
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const COL = {
            index: 3,
            date: 11,
            amount: 15,
            note: 25,
        };

        const lines = [];
        lines.push(title);
        lines.push(`Borrower: ${borrowerName}`);
        lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
        lines.push('');
        lines.push(`Original Amount: ${formatMoney(totalBorrowed)}   Total with Interest: ${formatMoney(totalWithInterest)}`);
        lines.push(`Total Paid: ${formatMoney(totalPaid)}   Remaining Balance: ${formatMoney(remainingBalance)}`);
        lines.push('');

        const header =
            `${padRight('#', COL.index)} ` +
            `${padRight('Date', COL.date)} ` +
            `${padLeft('Payment', COL.amount)} ` +
            `${padRight('Note', COL.note)}`;
        lines.push(header);
        lines.push('-'.repeat(header.length));

        if (transactions.length === 0) {
            lines.push('No payments to export.');
        } else {
            transactions.forEach((tx, idx) => {
                const dateLines = wrapText(formatDate(tx.date), COL.date);
                const amountLines = wrapText(formatMoney(tx.amount || 0), COL.amount);
                const noteLines = wrapText(tx.note || '-', COL.note);
                const rowHeight = Math.max(dateLines.length, amountLines.length, noteLines.length);

                for (let row = 0; row < rowHeight; row += 1) {
                    lines.push(
                        `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                        `${padRight(dateLines[row] || '', COL.date)} ` +
                        `${padLeft(amountLines[row] || '', COL.amount)} ` +
                        `${padRight(noteLines[row] || '', COL.note)}`
                    );
                }
            });
        }

        const pages = paginateLines(lines, 56);

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'borrow-summary');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

// ========== EXPENSE PDF EXPORT FUNCTIONS ==========

function buildExpenseReportLines({ title, subtitle, records, generatedAt }) {
    const COL = {
        index: 3,
        name: 18,
        category: 18,
        date: 12,
        amount: 12,
    };

    const totalAmount = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const lines = [];
    lines.push(title);
    if (subtitle) lines.push(subtitle);
    lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
    lines.push('');
    lines.push(`Total Expenses: ${formatMoney(totalAmount)}`);
    lines.push('');

    const header =
        `${padRight('#', COL.index)} ` +
        `${padRight('Name', COL.name)} ` +
        `${padRight('Category', COL.category)} ` +
        `${padRight('Date', COL.date)} ` +
        `${padLeft('Amount', COL.amount)}`;
    lines.push(header);
    lines.push('-'.repeat(header.length));

    if (records.length === 0) {
        lines.push('No expense records to export.');
        return lines;
    }

    records.forEach((record, idx) => {
        const amount = Number(record.amount || 0);

        const nameLines = wrapText(record.name || '-', COL.name);
        const categoryLines = wrapText(record.category || '-', COL.category);
        const dateLines = wrapText(formatDate(record.date), COL.date);
        const rowHeight = Math.max(nameLines.length, categoryLines.length, dateLines.length);

        for (let row = 0; row < rowHeight; row += 1) {
            lines.push(
                `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                `${padRight(nameLines[row] || '', COL.name)} ` +
                `${padRight(categoryLines[row] || '', COL.category)} ` +
                `${padRight(dateLines[row] || '', COL.date)} ` +
                `${padLeft(row === 0 ? formatMoney(amount) : '', COL.amount)}`
            );
        }
    });

    return lines;
}

export function exportExpenseRecordsToPdf({
    title = 'Expense Records Report',
    subtitle = '',
    records,
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const reportLines = buildExpenseReportLines({ title, subtitle, records, generatedAt });
        const pages = paginateLines(reportLines, 56);

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'expense-report');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}

// ========== SALES PDF EXPORT FUNCTIONS ==========

function buildSalesReportLines({ title, subtitle, records, generatedAt }) {
    const COL = {
        index: 3,
        sales: 12,
        status: 10,
        date: 12,
    };

    const totalSales = records.reduce((sum, r) => sum + Number(r.sales || 0), 0);

    const lines = [];
    lines.push(title);
    if (subtitle) lines.push(subtitle);
    lines.push(`Generated: ${generatedAt.toLocaleString('en-US')}`);
    lines.push('');
    lines.push(`Total Sales: ${formatMoney(totalSales)}`);
    lines.push('');

    const header =
        `${padRight('#', COL.index)} ` +
        `${padLeft('Sales', COL.sales)} ` +
        `${padRight('Status', COL.status)} ` +
        `${padRight('Date', COL.date)}`;
    lines.push(header);
    lines.push('-'.repeat(header.length));

    if (records.length === 0) {
        lines.push('No sales records to export.');
        return lines;
    }

    records.forEach((record, idx) => {
        const sales = Number(record.sales || 0);

        const salesLines = wrapText(formatMoney(sales), COL.sales);
        const statusLines = wrapText(record.status || '-', COL.status);
        const dateLines = wrapText(formatDate(record.date), COL.date);
        const rowHeight = Math.max(salesLines.length, statusLines.length, dateLines.length);

        for (let row = 0; row < rowHeight; row += 1) {
            lines.push(
                `${padRight(row === 0 ? String(idx + 1) : '', COL.index)} ` +
                `${padLeft(salesLines[row] || '', COL.sales)} ` +
                `${padRight(statusLines[row] || '', COL.status)} ` +
                `${padRight(dateLines[row] || '', COL.date)}`
            );
        }
    });

    return lines;
}

export function exportSalesRecordsToPdf({
    title = 'Sales Records Report',
    subtitle = '',
    records,
    filename = '',
    generatedAt = new Date(),
}) {
    try {
        const reportLines = buildSalesReportLines({ title, subtitle, records, generatedAt });
        const pages = paginateLines(reportLines, 56);

        const pdfBytes = buildPdf(pages);
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = makeFilename(filename || title || 'sales-report');
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return true;
    } catch (e) {
        return false;
    }
}
