// ============================================
// Tab Navigation Component
// ============================================

const TAB_ACTIVE = {
    taxi:   'tab-btn tab-active-blue',
    room:   'tab-btn tab-active-indigo',
    borrow: 'tab-btn tab-active-emerald',
    store:  'tab-btn tab-active-violet',
};
const TAB_INACTIVE = 'tab-btn';

export function showTab(tab) {
    const tabs = ['taxi', 'room', 'borrow', 'store'];

    tabs.forEach(t => {
        const section = document.getElementById(`${t}-section`);
        const tabEl = document.getElementById(`${t}-tab`);
        if (section) section.classList.add('hidden');
        if (tabEl) tabEl.className = TAB_INACTIVE;
    });

    const active = tabs.includes(tab) ? tab : 'room';
    const activeSection = document.getElementById(`${active}-section`);
    const activeTab = document.getElementById(`${active}-tab`);
    if (activeSection) activeSection.classList.remove('hidden');
    if (activeTab) activeTab.className = TAB_ACTIVE[active];

    if (window.location.hash !== `#${active}`) {
        window.history.replaceState(null, '', `#${active}`);
    }
}

window.showTab = showTab;

function showTabFromHash() {
    const tab = (window.location.hash || '#taxi').replace('#', '');
    showTab(tab);
}

window.addEventListener('hashchange', showTabFromHash);
window.addEventListener('DOMContentLoaded', showTabFromHash);
