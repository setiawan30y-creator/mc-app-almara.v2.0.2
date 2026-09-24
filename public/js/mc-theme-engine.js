(function () {
    'use strict';

    const KEY = 'mc_global_theme_v2';

    // Source of truth: current MC-Almara APV/Teller Workspace palette.
    const defaults = {
        primary: '#1D6C5D',
        primaryHover: '#123D35',
        secondary: '#69736F',
        pageBg: '#F7F5EF',
        cardBg: '#FCFBF7',
        sidebarBg: '#0B2F29',
        sidebarText: '#B8CEC4',
        headerBg: '#FFFFFF',
        text: '#18221F',
        textMuted: '#69736F',
        border: '#D7D8CF',
        inputBg: '#FFFFFF',
        inputBorder: '#D7D8CF',
        buttonBg: '#1D6C5D',
        buttonText: '#FFFFFF',
        shadow: '0 2px 12px rgba(0,0,0,.06)',
        radius: '12px',
        buy: '#16A34A',
        sell: '#A94138',
        draft: '#EAB308',
        final: '#16A34A'
    };

    const map = {
        primary:'--mc-primary', primaryHover:'--mc-primary-hover', secondary:'--mc-secondary',
        pageBg:'--mc-page-bg', cardBg:'--mc-card-bg', sidebarBg:'--mc-sidebar-bg', sidebarText:'--mc-sidebar-text',
        headerBg:'--mc-header-bg', text:'--mc-text', textMuted:'--mc-text-muted', border:'--mc-border',
        inputBg:'--mc-input-bg', inputBorder:'--mc-input-border', buttonBg:'--mc-button-bg', buttonText:'--mc-button-text',
        shadow:'--mc-shadow', radius:'--mc-radius', buy:'--mc-buy', sell:'--mc-sell', draft:'--mc-draft', final:'--mc-final'
    };

    function normalize(theme) {
        return Object.assign({}, defaults, theme || {});
    }

    function load() {
        try {
            const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
            return normalize(raw);
        } catch (e) {
            return normalize();
        }
    }

    function apply(theme, persist = true) {
        const t = normalize(theme);
        const root = document.documentElement;

        Object.keys(map).forEach(k => root.style.setProperty(map[k], t[k]));

        // Dashboard still uses the original styles.css variables. Bridge the
        // global theme into those variables so Dashboard follows the same theme.
        const legacy = {
            '--bg-dark': t.pageBg,
            '--panel-bg': t.cardBg,
            '--panel-border': t.border,
            '--text-primary': t.text,
            '--text-muted': t.textMuted,
            '--accent-green': t.buy,
            '--accent-green-hover': t.primaryHover,
            '--accent-red': t.sell,
            '--accent-blue': t.primary,
            '--accent-blue-hover': t.primaryHover,
            '--border-radius': t.radius
        };
        Object.keys(legacy).forEach(k => root.style.setProperty(k, legacy[k]));

        root.dataset.mcTheme = t.name || 'almara-default';

        // Keep Dashboard's APV theme class active. The APV stylesheet remains
        // responsible for structural styling while the variables above provide
        // the user-selected palette.
        if (document.body) document.body.classList.add('apv-theme');

        if (persist) {
            try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
        }
        window.dispatchEvent(new CustomEvent('mc-theme-applied', { detail: t }));
        return t;
    }

    function reset() {
        try { localStorage.removeItem(KEY); } catch (e) {}
        return apply(defaults, false);
    }

    window.MCTheme = { defaults, load, apply, reset, key: KEY, version: 3 };

    // Apply after DOM is available so Dashboard's body can receive apv-theme.
    if (document.body) apply(load(), false);
    else document.addEventListener('DOMContentLoaded', function () { apply(load(), false); }, { once: true });
})();
