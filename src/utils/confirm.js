// ============================================
// Confirmation Dialog System
// ============================================

export function showConfirm(message, title = 'Delete Record') {
    return new Promise((resolve) => {
        const modal      = document.getElementById('confirm-modal');
        const titleEl    = document.getElementById('confirm-title');
        const messageEl  = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-yes');
        const cancelBtn  = document.getElementById('confirm-no');
        const backdrop   = document.getElementById('confirm-backdrop');

        if (!modal) { resolve(true); return; }

        titleEl.textContent   = title;
        messageEl.textContent = message;
        modal.classList.remove('hidden');

        function cleanup() {
            modal.classList.add('hidden');
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            backdrop.removeEventListener('click', onCancel);
        }

        function onConfirm() { cleanup(); resolve(true); }
        function onCancel()  { cleanup(); resolve(false); }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        backdrop.addEventListener('click', onCancel);
    });
}

window.showConfirm = showConfirm;
