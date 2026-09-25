/*
 * MC-Almara - Theme Settings sidebar menu
 * Adds a dedicated button to /settings/theme without changing the existing
 * dashboard navigation targets.
 */
(function () {
    'use strict';

    function addThemeSettingsMenu() {
        var sidebarNav = document.querySelector('.sidebar-nav');
        if (!sidebarNav || sidebarNav.querySelector('[data-theme-settings-menu="true"]')) {
            return;
        }

        var group = document.createElement('div');
        group.className = 'theme-settings-nav-group';
        group.innerHTML =
            '<div class="sidebar-group-title" style="padding:15px 20px 6px 15px;color:#475569;font-size:.7rem;font-weight:800;text-transform:uppercase;letter-spacing:.8px;border-bottom:1px solid rgba(255,255,255,.02);margin-top:10px;margin-bottom:5px;">Pengaturan</div>' +
            '<a href="/settings/theme" class="nav-item" data-theme-settings-menu="true" title="Tema & Tampilan" onclick="event.preventDefault();event.stopPropagation();window.location.assign(\'/settings/theme\');">' +
                '<i class="fa-solid fa-palette" style="color:#a78bfa;"></i> Tema & Tampilan' +
            '</a>';

        sidebarNav.appendChild(group);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addThemeSettingsMenu);
    } else {
        addThemeSettingsMenu();
    }

    // Dashboard UI can be re-rendered by other modules, so retry briefly.
    var attempts = 0;
    var timer = setInterval(function () {
        addThemeSettingsMenu();
        attempts++;
        if (attempts >= 20 || document.querySelector('[data-theme-settings-menu="true"]')) {
            clearInterval(timer);
        }
    }, 250);
})();
