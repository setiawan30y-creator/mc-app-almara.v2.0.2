(function () {
    'use strict';

    const KEY = 'mc_global_theme_v2';

    // Source of truth: current MC-Almara APV/Teller Workspace palette.
    const defaults = {
        primary: '#1D6C5D',
        primaryHover: '#123D35',
        secondary: '#69736F',
        pageBg: '#F0F4F8',
        cardBg: '#FFFFFF',
        sidebarBg: '#0B2F29',
        sidebarText: '#B8CEC4',
        headerBg: '#FFFFFF',
        text: '#18221F',
        textMuted: '#64748B',
        border: '#E2E8F0',
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
        root.dataset.mcTheme = t.name || 'almara-default';
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

    window.MCTheme = { defaults, load, apply, reset, key: KEY, version: 2 };
    apply(load(), false);
})();
