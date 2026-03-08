const LANG_KEY = 'appLanguage';

const TRANSLATIONS = {
    en: {
        app_title: 'Rent Money and Sari-Sari Store',
        app_subtitle: 'Track taxi rent, money owed & store profits',
        language_label: 'Language',
        theme_label: 'Theme',
        theme_light: 'Light',
        theme_night: 'Night',
        lang_english: 'English',
        lang_bisaya: 'Bisaya',
        summary_taxi: 'Taxi Rent',
        summary_room: 'Room for Rent',
        summary_borrow: 'Owed to You',
        summary_store: 'Store Profit',
        tab_taxi: 'Taxi Rent',
        tab_room: 'Room for Rent',
        tab_borrow: 'Borrow / Owe Me',
        tab_store: 'Sari-Sari Store',
        driver_summary: 'Driver Summary',
        renter_summary: 'Renter Summary',
    },
    bis: {
        app_title: 'Abang ug Sari-Sari Store',
        app_subtitle: 'Subayi ang abang sa taxi, utang nila, ug kita sa tindahan',
        language_label: 'Pinulongan',
        theme_label: 'Tema',
        theme_light: 'Hayag',
        theme_night: 'Ngitngit',
        lang_english: 'English',
        lang_bisaya: 'Bisaya',
        summary_taxi: 'Abang sa Taxi',
        summary_room: 'Abang sa Kwarto',
        summary_borrow: 'Utang Nila Nimo',
        summary_store: 'Kita sa Tindahan',
        tab_taxi: 'Abang Taxi',
        tab_room: 'Abang Kwarto',
        tab_borrow: 'Utang / Hulmon',
        tab_store: 'Sari-Sari Store',
        driver_summary: 'Summary sa Driver',
        renter_summary: 'Summary sa Renter',
    },
};

function getSavedLanguage() {
    const value = localStorage.getItem(LANG_KEY);
    return value === 'bis' ? 'bis' : 'en';
}

function translate(key, language) {
    const table = TRANSLATIONS[language] || TRANSLATIONS.en;
    return table[key] ?? TRANSLATIONS.en[key] ?? key;
}

export function applyLanguage(language) {
    const lang = language === 'bis' ? 'bis' : 'en';
    document.documentElement.lang = lang === 'bis' ? 'ceb' : 'en';

    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        if (!key) return;
        el.textContent = translate(key, lang);
    });

    localStorage.setItem(LANG_KEY, lang);
    window.dispatchEvent(new CustomEvent('app-language-changed', { detail: { language: lang } }));
}

export function initLanguageSwitcher() {
    const select = document.getElementById('app-language-select');
    const current = getSavedLanguage();

    applyLanguage(current);

    if (!select) return;
    select.value = current;
    select.addEventListener('change', (event) => {
        applyLanguage(event.target.value);
    });
}
