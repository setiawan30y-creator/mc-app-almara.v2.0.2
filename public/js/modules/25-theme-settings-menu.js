/*
 * MC-Almara - Theme Settings sidebar menu
 * Adds a dedicated button to /settings/theme without changing existing dashboard navigation.
 */
(function () {
    'use strict';

    function getSidebarNav() {
        return document.querySelector('.sidebar nav') || document.querySelector('.sidebar-nav');
    }

    function addThemeSettingsMenu() {
        var sidebarNav = getSidebarNav();
        if (!sidebarNav) return false;

        if (sidebarNav.querySelector('[data-theme-settings-menu="true"]') || sidebarNav.querySelector('a[href="/settings/theme"]')) {
            return true;
        }

        var settingsItem = sidebarNav.querySelector('a[data-target="settings-view"]');
        var button = document.createElement('a');
        button.href = '/settings/theme';
        button.className = 'nav-item';
        button.setAttribute('data-theme-settings-menu', 'true');
        button.title = 'Tema & Tampilan';
        button.innerHTML = '<i class="fa-solid fa-palette" style="color:#a78bfa;"></i> Tema & Tampilan';

        if (settingsItem && settingsItem.parentNode) {
            settingsItem.parentNode.insertBefore(button, settingsItem.nextSibling);
        } else {
            sidebarNav.appendChild(button);
        }

        return true;
    }

    function init() {
        if (addThemeSettingsMenu()) return;

        var attempts = 0;
        var timer = setInterval(function () {
            if (addThemeSettingsMenu() || ++attempts >= 40) {
                clearInterval(timer);
            }
        }, 250);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
