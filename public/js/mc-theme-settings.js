document.addEventListener('DOMContentLoaded', function () {
    if (!window.MCTheme) return;
    const fields = ['primary','primaryHover','secondary','pageBg','cardBg','sidebarBg','sidebarText','headerBg','text','textMuted','border','inputBg','inputBorder','buttonBg','buttonText','buy','sell','draft','final'];
    const textFields = ['shadow','radius'];
    const theme = MCTheme.load();

    fields.forEach(k => {
        const el = document.getElementById('theme-' + k);
        if (el) el.value = theme[k];
    });
    textFields.forEach(k => {
        const el = document.getElementById('theme-' + k);
        if (el) el.value = theme[k];
    });
    refreshPreview();

    document.querySelectorAll('[data-theme-field]').forEach(el => {
        el.addEventListener('input', refreshPreview);
        el.addEventListener('change', refreshPreview);
    });

    document.getElementById('theme-save')?.addEventListener('click', function () {
        MCTheme.apply(readForm());
        toast('Tema berhasil disimpan.');
    });
    document.getElementById('theme-reset')?.addEventListener('click', function () {
        MCTheme.apply(MCTheme.defaults);
        location.reload();
    });
    document.querySelectorAll('[data-preset]').forEach(btn => btn.addEventListener('click', function () {
        const preset = this.dataset.preset === 'dark' ? darkPreset : this.dataset.preset === 'emerald' ? emeraldPreset : MCTheme.defaults;
        fillForm(preset); refreshPreview();
    }));

    function readForm() {
        const out = {};
        [...fields, ...textFields].forEach(k => {
            const el = document.getElementById('theme-' + k);
            if (el) out[k] = el.value;
        });
        return out;
    }
    function fillForm(t) {
        Object.keys(t).forEach(k => { const el = document.getElementById('theme-' + k); if (el) el.value = t[k]; });
    }
    function refreshPreview() {
        const t = readForm();
        const p = document.getElementById('theme-preview');
        if (!p) return;
        p.style.setProperty('--p-primary', t.primary);
        p.style.setProperty('--p-page', t.pageBg);
        p.style.setProperty('--p-card', t.cardBg);
        p.style.setProperty('--p-sidebar', t.sidebarBg);
        p.style.setProperty('--p-sidebar-text', t.sidebarText);
        p.style.setProperty('--p-text', t.text);
        p.style.setProperty('--p-muted', t.textMuted);
        p.style.setProperty('--p-border', t.border);
        p.style.setProperty('--p-button', t.buttonBg);
        p.style.setProperty('--p-button-text', t.buttonText);
        p.style.setProperty('--p-shadow', t.shadow);
        p.style.setProperty('--p-radius', t.radius);
    }
    function toast(message) {
        const el = document.getElementById('theme-toast');
        if (!el) return;
        el.textContent = message; el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 1800);
    }
    const darkPreset = Object.assign({}, MCTheme.defaults, {pageBg:'#0f172a',cardBg:'#1e293b',sidebarBg:'#020617',sidebarText:'#e2e8f0',headerBg:'#111827',text:'#f8fafc',textMuted:'#94a3b8',border:'#334155',inputBg:'#0f172a',inputBorder:'#475569',buttonBg:'#3b82f6'});
    const emeraldPreset = Object.assign({}, MCTheme.defaults, {primary:'#059669',primaryHover:'#047857',buttonBg:'#059669',sidebarBg:'#064e3b',buy:'#16a34a'});
});
