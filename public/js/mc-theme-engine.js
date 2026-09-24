(function () {
    'use strict';

    const KEY = 'mc_global_theme_v1';
    const defaults = {
        primary:'#2563eb', primaryHover:'#1d4ed8', secondary:'#64748b',
        pageBg:'#f8fafc', cardBg:'#ffffff', sidebarBg:'#111827', sidebarText:'#ffffff',
        headerBg:'#ffffff', text:'#111827', textMuted:'#64748b', border:'#e5e7eb',
        inputBg:'#ffffff', inputBorder:'#d1d5db', buttonBg:'#2563eb', buttonText:'#ffffff',
        shadow:'0 4px 14px rgba(15,23,42,.08)', radius:'12px',
        buy:'#16a34a', sell:'#dc2626', draft:'#eab308', final:'#16a34a'
    };

    function load() {
        try { return Object.assign({}, defaults, JSON.parse(localStorage.getItem(KEY) || '{}')); }
        catch (e) { return Object.assign({}, defaults); }
    }

    function apply(theme) {
        const t = Object.assign({}, defaults, theme || {});
        const root = document.documentElement;
        const map = {
            primary:'--mc-primary', primaryHover:'--mc-primary-hover', secondary:'--mc-secondary',
            pageBg:'--mc-page-bg', cardBg:'--mc-card-bg', sidebarBg:'--mc-sidebar-bg', sidebarText:'--mc-sidebar-text',
            headerBg:'--mc-header-bg', text:'--mc-text', textMuted:'--mc-text-muted', border:'--mc-border',
            inputBg:'--mc-input-bg', inputBorder:'--mc-input-border', buttonBg:'--mc-button-bg', buttonText:'--mc-button-text',
            shadow:'--mc-shadow', radius:'--mc-radius', buy:'--mc-buy', sell:'--mc-sell', draft:'--mc-draft', final:'--mc-final'
        };
        Object.keys(map).forEach(k => root.style.setProperty(map[k], t[k]));
        try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {}
        window.dispatchEvent(new CustomEvent('mc-theme-applied', {detail:t}));
        return t;
    }

    window.MCTheme = { defaults, load, apply, key:KEY };
    apply(load());
})();
