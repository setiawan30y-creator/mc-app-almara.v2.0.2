/*
 * MC Almara - Sidebar navigation recovery layer
 * Keeps sidebar navigation working even when another frontend module fails.
 */
(function () {
    'use strict';

    function run() {
        const sidebar = document.getElementById('sidebar');
        const nav = sidebar ? sidebar.querySelector('.sidebar-nav') : document.querySelector('.sidebar-nav');
        if (!nav || nav.dataset.sidebarFixReady === '1') return;
        nav.dataset.sidebarFixReady = '1';

        // Make sure no transparent/stacking layer disables pointer interaction.
        if (sidebar) {
            sidebar.style.pointerEvents = 'auto';
            sidebar.style.zIndex = '1100';
        }
        nav.style.pointerEvents = 'auto';

        // Replace only nav anchors. Cloning removes stale/broken click handlers
        // without changing their HTML, labels, icons or data-target attributes.
        nav.querySelectorAll('a.nav-item[data-target]').forEach(function (item) {
            const clone = item.cloneNode(true);
            item.replaceWith(clone);
        });

        const loaders = {
            'dashboard-view': function () { if (typeof window.refreshTransactionsThen === 'function' && typeof window.loadDashboard === 'function') window.refreshTransactionsThen(function () { window.loadDashboard(); }); },
            'pos-view': function () { if (typeof window.loadPosForm === 'function') window.loadPosForm(); },
            'demo-pos-view': function () { if (typeof window.loadDemoPos === 'function') window.loadDemoPos(); },
            'booking-view': function () { if (typeof window.loadBookingsTable === 'function') window.loadBookingsTable(); },
            'currency-view': function () { if (typeof window.loadCurrencyTable === 'function') window.loadCurrencyTable(); },
            'kurs-hari-ini-view': function () { if (typeof window.loadKursHariIniTable === 'function') window.loadKursHariIniTable(); },
            'mutation-view': function () { if (typeof window.loadMutationsTable === 'function') window.loadMutationsTable(); },
            'customers-view': function () { if (typeof window.loadCustomersTable === 'function') window.loadCustomersTable(); },
            'expense-view': function () { if (typeof window.loadExpensesTable === 'function') window.loadExpensesTable(); },
            'adjustment-view': function () { if (typeof window.loadAdjustmentsTable === 'function') window.loadAdjustmentsTable(); },
            'harian-view': function () { if (typeof window.loadLaporanHarian === 'function') window.loadLaporanHarian(); },
            'reports-view': function () { if (typeof window.refreshTransactionsThen === 'function' && typeof window.loadReportsTable === 'function') window.refreshTransactionsThen(function () { window.loadReportsTable(); }); },
            'laporan-lku-view': function () { if (typeof window.loadLaporanLku === 'function') window.loadLaporanLku(); },
            'laporan-granular-view': function () { if (typeof window.loadLaporanGranular === 'function') window.loadLaporanGranular(); },
            'laporan-sipesat-view': function () { if (typeof window.loadLaporanSipesat === 'function') window.loadLaporanSipesat(); },
            'laporan-bukubesar-view': function () { if (typeof window.loadBukuBesar === 'function') window.loadBukuBesar(); },
            'laporan-labarugi-view': function () { if (typeof window.loadLabaRugi === 'function') window.loadLabaRugi(); },
            'laporan-neraca-view': function () { if (typeof window.loadNeraca === 'function') window.loadNeraca(); },
            'laporan-ekuitas-view': function () { if (typeof window.loadEkuitasUi === 'function') window.loadEkuitasUi(); },
            'laporan-coretax-view': function () { if (typeof window.loadCoretaxReport === 'function') window.loadCoretaxReport(); },
            'laporan-posisi-valuta-view': function () { if (typeof window.initLaporanPosisiValuta === 'function') window.initLaporanPosisiValuta(); },
            'laporan-aset-view': function () { if (typeof window.loadAssetReport === 'function') window.loadAssetReport(); },
            'closing-view': function () { if (typeof window.initClosingView === 'function') window.initClosingView(); },
            'pickup-view': function () { if (typeof window.initPickupView === 'function') window.initPickupView(); },
            'gantungan-view': function () { if (typeof window.initGantunganView === 'function') window.initGantunganView(); },
            'masterdata-view': function () { if (typeof window.loadMasterDataView === 'function') window.loadMasterDataView(); },
            'settings-view': function () { if (typeof window.loadSettingsProfile === 'function') window.loadSettingsProfile(); },
            'hris-view': function () { if (typeof window.switchHrisTab === 'function') window.switchHrisTab('emp'); }
        };

        nav.addEventListener('click', function (event) {
            const item = event.target.closest('a.nav-item[data-target]');
            if (!item || !nav.contains(item)) return;

            const targetId = item.getAttribute('data-target');
            const target = targetId ? document.getElementById(targetId) : null;
            if (!target) {
                event.preventDefault();
                console.warn('[Sidebar] Target view tidak ditemukan:', targetId);
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            nav.querySelectorAll('a.nav-item[data-target]').forEach(function (navItem) {
                navItem.classList.toggle('active', navItem === item);
            });

            document.querySelectorAll('.view-section').forEach(function (view) {
                view.classList.toggle('hidden', view !== target);
                view.classList.toggle('active', view === target);
            });

            const title = document.getElementById('pageTitle');
            if (title) title.textContent = item.textContent.trim();

            if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');

            try {
                const loader = loaders[targetId];
                if (loader) loader();
            } catch (error) {
                console.error('[Sidebar] Gagal memuat view ' + targetId + ':', error);
            }
        });

        window.toggleNavMenu = window.toggleNavMenu || function (id) {
            const menu = document.getElementById(id);
            if (!menu) return;
            const opening = getComputedStyle(menu).display === 'none';
            menu.style.display = opening ? 'block' : 'none';
            const icon = document.getElementById('icon-' + id);
            if (icon) icon.classList.toggle('fa-chevron-up', opening);
            if (icon) icon.classList.toggle('fa-chevron-down', !opening);
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run, { once: true });
    } else {
        run();
    }
})();
