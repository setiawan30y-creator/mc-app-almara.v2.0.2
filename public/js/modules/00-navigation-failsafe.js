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

        // These refreshes are deliberately fire-and-forget. Navigation must never
        // wait for MySQL/API synchronization before the user can interact.
        if (targetId === 'dashboard-view' && typeof window.loadDashboard === 'function') {
            try { Promise.resolve(window.loadDashboard()).catch(function () {}); } catch (e) {}
        }
        if (targetId === 'pos-view' && typeof window.refreshActiveRealtimeViews === 'function') {
            try { Promise.resolve(window.refreshActiveRealtimeViews()).catch(function () {}); } catch (e) {}
        }

        return true;
    }

    function bind() {
        document.addEventListener('click', function (event) {
            var link = event.target && event.target.closest
                ? event.target.closest('.sidebar-nav .nav-item[data-target]')
                : null;
            if (!link) return;

            var targetId = link.getAttribute('data-target');
            if (!targetId) return;

            // If the normal 01-core handler is healthy it may also run. We still
            // own the navigation result so a failed module cannot leave the UI inert.
            if (document.getElementById(targetId)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                activateView(targetId, link);
            }
        }, true);

        // Make the main accordion menus independent from the rest of the app.
        document.querySelectorAll('.nav-accordion-header[onclick]').forEach(function (header) {
            header.addEventListener('click', function () {
                var match = String(header.getAttribute('onclick') || '').match(/toggleNavMenu\(['"]([^'"]+)['"]\)/);
                if (!match) return;
                var menu = document.getElementById(match[1]);
                if (!menu) return;
                menu.style.display = menu.style.display === 'none' || !menu.style.display ? 'block' : 'none';
            }, true);
        });

        // Remove stale diagnostic click-blocking styles if an older cached build left them behind.
        var logger = document.getElementById('visual-error-logger');
        if (logger) logger.style.pointerEvents = 'none';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind, { once: true });
    } else {
        bind();
    }
})();
