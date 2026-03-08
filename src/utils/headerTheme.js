const HEADER_THEME_KEY = 'appHeaderTheme';
const THEMES = {
    light: 'light',
    night: 'night',
};

function getSavedTheme() {
    const value = localStorage.getItem(HEADER_THEME_KEY);
    return value === THEMES.night ? THEMES.night : THEMES.light;
}

function applyTheme(theme) {
    const header = document.getElementById('app-header');
    if (!header) return;

    header.classList.remove('bg-slate-900', 'bg-slate-950', 'bg-gradient-to-br', 'from-blue-900', 'via-blue-800', 'to-violet-800');

    if (theme === THEMES.night) {
        header.classList.add('bg-slate-900');
    } else {
        header.classList.add('bg-gradient-to-br', 'from-blue-900', 'via-blue-800', 'to-violet-800');
    }

    localStorage.setItem(HEADER_THEME_KEY, theme);
}

export function initHeaderThemeSwitcher() {
    const select = document.getElementById('app-header-theme-select');
    const current = getSavedTheme();

    applyTheme(current);

    if (!select) return;
    select.value = current;
    select.addEventListener('change', (event) => {
        const theme = event.target.value === THEMES.night ? THEMES.night : THEMES.light;
        applyTheme(theme);
    });
}

