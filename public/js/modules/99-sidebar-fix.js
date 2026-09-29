/* MC Almara - resilient sidebar navigation */
(function () {
    'use strict';
    function activate() {
        const sidebar = document.getElementById('sidebar');
        const nav = sidebar?.querySelector('.sidebar-nav') || document.querySelector('.sidebar-nav');
        if (!nav) return false;
        if (nav.dataset.sidebarRecoveryReady === '1') return true;
        nav.dataset.sidebarRecoveryReady = '1';
        Object.assign(nav.style, { pointerEvents:'auto', position:'relative', zIndex:'10001' });
        if (sidebar) Object.assign(sidebar.style, { pointerEvents:'auto', zIndex:'10000' });

        nav.querySelectorAll('a.nav-item[data-target]').forEach(function (item) {
            const clean = item.cloneNode(true);
            clean.style.pointerEvents = 'auto';
            clean.style.cursor = 'pointer';
            item.replaceWith(clean);
        });

        const loaders = {
            'dashboard-view': () => typeof refreshTransactionsThen === 'function' && refreshTransactionsThen(() => loadDashboard()),
            'pos-view': () => typeof loadPosForm === 'function' && loadPosForm(),
            'demo-pos-view': () => typeof window.loadDemoPos === 'function' && window.loadDemoPos(),
            'booking-view': () => typeof loadBookingsTable === 'function' && loadBookingsTable(),
            'currency-view': () => typeof loadCurrencyTable === 'function' && loadCurrencyTable(),
            'kurs-hari-ini-view': () => typeof loadKursHariIniTable === 'function' && loadKursHariIniTable(),
            'mutation-view': () => typeof loadMutationsTable === 'function' && loadMutationsTable(),
            'customers-view': () => typeof loadCustomersTable === 'function' && loadCustomersTable(),
            'expense-view': () => typeof loadExpensesTable === 'function' && loadExpensesTable(),
            'adjustment-view': () => typeof loadAdjustmentsTable === 'function' && loadAdjustmentsTable(),
            'harian-view': () => typeof loadLaporanHarian === 'function' && loadLaporanHarian(),
            'reports-view': () => typeof refreshTransactionsThen === 'function' && refreshTransactionsThen(() => loadReportsTable()),
            'laporan-lku-view': () => typeof loadLaporanLku === 'function' && loadLaporanLku(),
            'laporan-granular-view': () => typeof loadLaporanGranular === 'function' && loadLaporanGranular(),
            'laporan-sipesat-view': () => typeof loadLaporanSipesat === 'function' && loadLaporanSipesat(),
            'laporan-goaml-view': () => typeof loadLaporanGoaml === 'function' && loadLaporanGoaml(),
            'laporan-sipendar-view': () => typeof loadLaporanSipendar === 'function' && loadLaporanSipendar(),
            'laporan-bukubesar-view': () => typeof loadBukuBesar === 'function' && loadBukuBesar(),
            'laporan-labarugi-view': () => typeof loadLabaRugi === 'function' && loadLabaRugi(),
            'laporan-neraca-view': () => typeof loadNeraca === 'function' && loadNeraca(),
            'laporan-ekuitas-view': () => typeof loadEkuitasUi === 'function' && loadEkuitasUi(),
            'laporan-coretax-view': () => typeof loadCoretaxReport === 'function' && loadCoretaxReport(),
            'laporan-posisi-valuta-view': () => typeof initLaporanPosisiValuta === 'function' && initLaporanPosisiValuta(),
            'laporan-aset-view': () => typeof loadAssetReport === 'function' && loadAssetReport(),
            'closing-view': () => typeof initClosingView === 'function' && initClosingView(),
            'pickup-view': () => typeof initPickupView === 'function' && initPickupView(),
            'gantungan-view': () => typeof window.initGantunganView === 'function' && window.initGantunganView(),
            'masterdata-view': () => typeof loadMasterDataView === 'function' && loadMasterDataView(),
            'settings-view': () => typeof loadSettingsProfile === 'function' && loadSettingsProfile(),
            'hris-view': () => typeof switchHrisTab === 'function' && switchHrisTab('emp')
        };

        function navigate(item) {
            const targetId = item?.getAttribute('data-target');
            const target = targetId && document.getElementById(targetId);
            if (!target) return false;
            nav.querySelectorAll('a.nav-item[data-target]').forEach(link => link.classList.toggle('active', link === item));
            document.querySelectorAll('.view-section').forEach(view => {
                const active = view === target;
                view.classList.toggle('hidden', !active);
                view.classList.toggle('active', active);
            });
            const title = document.getElementById('pageTitle');
            if (title) title.textContent = item.textContent.replace(/\s+/g, ' ').trim();
            if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
            try { if (loaders[targetId]) loaders[targetId](); } catch (error) { console.error('[Sidebar] loader error:', targetId, error); }
            window.dispatchEvent(new CustomEvent('almara:sidebar-navigated', { detail:{ targetId } }));
            return true;
        }

        nav.addEventListener('click', function (event) {
            const item = event.target.closest('a.nav-item[data-target]');
            if (!item || !nav.contains(item)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            navigate(item);
        }, true);
        nav.addEventListener('pointerup', function (event) {
            if (event.pointerType === 'mouse') return;
            const item = event.target.closest('a.nav-item[data-target]');
            if (!item || !nav.contains(item)) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            navigate(item);
        }, true);
        window.toggleNavMenu = function (id) {
            const menu = document.getElementById(id);
            if (!menu) return;
            const opening = getComputedStyle(menu).display === 'none';
            menu.style.display = opening ? 'block' : 'none';
            const icon = document.getElementById('icon-' + id);
            if (icon) { icon.classList.toggle('fa-chevron-up', opening); icon.classList.toggle('fa-chevron-down', !opening); }
        };
        console.log('[Sidebar] Recovery layer aktif:', nav.querySelectorAll('a.nav-item[data-target]').length, 'menu');
        return true;
    }
    function boot() {
        if (activate()) return;
        let tries = 0;
        const timer = setInterval(() => { if (activate() || ++tries >= 20) clearInterval(timer); }, 100);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
    else boot();
})();
