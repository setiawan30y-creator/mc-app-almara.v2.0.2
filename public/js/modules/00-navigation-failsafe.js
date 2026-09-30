(function () {
    'use strict';

    function activateView(targetId, link) {
        if (!targetId) return false;
        var target = document.getElementById(targetId);
        if (!target) return false;

        document.querySelectorAll('.view-section').forEach(function (section) {
            section.classList.add('hidden');
            section.classList.remove('active');
            section.style.display = '';
        });

        target.classList.remove('hidden');
        target.classList.add('active');
        target.style.display = '';

        document.querySelectorAll('.sidebar-nav .nav-item[data-target]').forEach(function (item) {
            item.classList.toggle('active', item === link);
            if (item === link) item.setAttribute('aria-current', 'page');
            else item.removeAttribute('aria-current');
        });

        var title = link ? link.textContent.replace(/\s+/g, ' ').trim() : '';
        var pageTitle = document.getElementById('pageTitle');
        if (pageTitle && title) pageTitle.textContent = title;

        try {
            window.dispatchEvent(new CustomEvent('almara:viewchange', {
                detail: { targetId: targetId, link: link || null }
            }));
        } catch (e) {}

        // Never block navigation on database/network work.
        if (targetId === 'dashboard-view' && typeof window.loadDashboard === 'function') {
            try { Promise.resolve(window.loadDashboard()).catch(function () {}); } catch (e) {}
        }
        if (targetId === 'pos-view' && typeof window.refreshActiveRealtimeViews === 'function') {
            try { Promise.resolve(window.refreshActiveRealtimeViews()).catch(function () {}); } catch (e) {}
        }

        return true;
    }

    function installRealtimeGuard() {
        // sync.js currently starts a 4-second UI-refresh loop immediately. That
        // loop can overlap loadDashboard(), API calls and Universal Datastore work,
        // making the browser main thread appear frozen. Stop it once the module is
        // available and replace it with a quiet background sync.
        var stopped = false;
        var poll = setInterval(function () {
            if (typeof window.stopAlmaraRealtimeSync !== 'function') return;
            if (!stopped) {
                try { window.stopAlmaraRealtimeSync(); } catch (e) {}
                stopped = true;
            }
            clearInterval(poll);

            if (window.__almaraQuietSyncTimer) clearInterval(window.__almaraQuietSyncTimer);
            window.__almaraQuietSyncTimer = setInterval(async function () {
                if (window.__almaraQuietSyncBusy) return;
                window.__almaraQuietSyncBusy = true;
                try {
                    if (typeof window.syncFromMySQL_Transactions === 'function') {
                        await window.syncFromMySQL_Transactions({ pushLocal: false, refreshUi: false, silent: true });
                    }
                    if (typeof window.syncFromMySQL_Currencies === 'function') {
                        await window.syncFromMySQL_Currencies({ refreshUi: false, silent: true });
                    }
                    if (typeof window.syncFromMySQL_Customers === 'function') {
                        await window.syncFromMySQL_Customers({ refreshUi: false, silent: true });
                    }
                } catch (e) {
                    // Background sync must never surface an exception into navigation.
                } finally {
                    window.__almaraQuietSyncBusy = false;
                }
            }, 30000);
        }, 250);
    }

    function bind() {
        document.addEventListener('click', function (event) {
            var link = event.target && event.target.closest
                ? event.target.closest('.sidebar-nav .nav-item[data-target]')
                : null;
            if (!link) return;

            var targetId = link.getAttribute('data-target');
            if (!targetId) return;

            if (document.getElementById(targetId)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                activateView(targetId, link);
            }
        }, true);

        document.querySelectorAll('.nav-accordion-header[onclick]').forEach(function (header) {
            header.addEventListener('click', function () {
                var match = String(header.getAttribute('onclick') || '').match(/toggleNavMenu\(['"]([^'"]+)['"]\)/);
                if (!match) return;
                var menu = document.getElementById(match[1]);
                if (!menu) return;
                menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
            }, true);
        });

        var logger = document.getElementById('visual-error-logger');
        if (logger) logger.style.pointerEvents = 'none';

        installRealtimeGuard();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
})();
