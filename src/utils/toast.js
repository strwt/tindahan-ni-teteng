// ============================================
// Toast Notification System
// ============================================

const TYPE_CONFIG = {
    success: { bg: 'bg-emerald-500', icon: '✓' },
    error:   { bg: 'bg-red-500',     icon: '✕' },
    warning: { bg: 'bg-amber-500',   icon: '!' },
    info:    { bg: 'bg-blue-500',    icon: 'i' },
};

export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const { bg, icon } = TYPE_CONFIG[type] || TYPE_CONFIG.info;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-xs toast-enter ${bg}`;
    toast.innerHTML = `
        <span class="w-6 h-6 rounded-full bg-white bg-opacity-25 flex items-center justify-center text-xs font-bold shrink-0">${icon}</span>
        <span class="flex-1 leading-snug">${message}</span>
        <button class="opacity-60 hover:opacity-100 transition-opacity ml-1 text-lg leading-none" data-dismiss>×</button>
    `;

    toast.querySelector('[data-dismiss]').addEventListener('click', () => dismissToast(toast));
    container.appendChild(toast);

    const timer = setTimeout(() => dismissToast(toast), duration);
    toast._timer = timer;
}

function dismissToast(toast) {
    if (!toast.isConnected) return;
    clearTimeout(toast._timer);
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 280);
}

window.showToast = showToast;
