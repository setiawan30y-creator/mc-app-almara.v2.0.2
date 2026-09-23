/*
 * ERP Closing Bridge
 *
 * Keeps the existing cashier-facing Closing Harian screen, but makes ERP
 * Ledger the source of truth for Expected Cash + Outstanding Gantungan.
 * Loaded after 05-finance-ops.js.
 */
(function () {
    'use strict';

    const ERP_SUMMARY_URL = '/erp/closing/summary';
    const ERP_STORE_URL = '/erp/closing';

    function csrfToken() {
        return typeof window.getCsrfToken === 'function'
            ? window.getCsrfToken()
            : (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
    }

    function selectedClosingDate() {
        return document.getElementById('closingDateInput')?.value?.slice(0, 10)
            || new Date().toISOString().slice(0, 10);
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = typeof formatIdr === 'function' ? formatIdr(value) : `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
    }

    async function fetchErpSummary(date = selectedClosingDate()) {
        const response = await fetch(`${ERP_SUMMARY_URL}?date=${encodeURIComponent(date)}&ts=${Date.now()}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`ERP summary HTTP ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success' || !result.data) throw new Error('Format ERP summary tidak valid.');
        return result.data;
    }

    async function refreshClosingFromErp() {
        const view = document.getElementById('closing-view');
        if (!view || !view.classList.contains('active')) return;

        try {
            const data = await fetchErpSummary();
            window.__almaraErpClosingSummary = data;

            // These fields are deliberately ERP-driven. The old visual layout remains unchanged.
            setText('closingKasSistem', data.expected_cash);
            setText('closingGantunganPiutang', Math.max(0, data.hanging_amount));
            setText('closingGantunganUtang', 0);
            setText('closingTotalExpenses', data.expense);

            const physicalText = document.getElementById('closingFisik')?.textContent || 'Rp 0';
            const physical = parseInt(String(physicalText).replace(/[^\d]/g, ''), 10) || 0;
            const difference = physical + Number(data.hanging_amount || 0) - Number(data.expected_cash || 0);
            const diffNode = document.getElementById('closingSelisih');
            if (diffNode) {
                const abs = Math.abs(difference);
                diffNode.textContent = `${difference < 0 ? '-' : difference > 0 ? '+' : ''}${typeof formatIdr === 'function' ? formatIdr(abs) : 'Rp ' + abs.toLocaleString('id-ID')}`;
                diffNode.style.color = difference === 0 ? '#10B981' : difference < 0 ? '#F87171' : '#3B82F6';
            }

            const sourceNode = document.getElementById('closingErpSourceStatus');
            if (sourceNode) {
                sourceNode.textContent = `ERP Ledger aktif • Expected Cash ${typeof formatIdr === 'function' ? formatIdr(data.expected_cash) : data.expected_cash}`;
                sourceNode.style.color = '#10B981';
            }
        } catch (error) {
            console.warn('[ERP Closing] Gagal mengambil summary ERP:', error);
            const sourceNode = document.getElementById('closingErpSourceStatus');
            if (sourceNode) {
                sourceNode.textContent = 'ERP Ledger belum tersambung — angka lokal tidak dianggap final.';
                sourceNode.style.color = '#F59E0B';
            }
        }
    }

    async function postFinalClosingToErp() {
        const totalFisikStr = document.getElementById('closingFisik')?.textContent || 'Rp 0';
        const physicalCash = parseInt(String(totalFisikStr).replace(/[^\d]/g, ''), 10) || 0;
        const dateInput = document.getElementById('closingDateInput');
        const closingDate = dateInput?.value ? new Date(dateInput.value).toISOString() : new Date().toISOString();
        const notes = document.getElementById('closingNote')?.value || '';

        const response = await fetch(ERP_STORE_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json, text/html',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrfToken()
            },
            body: new URLSearchParams({
                closing_date: closingDate,
                physical_cash: String(physicalCash),
                notes: notes || 'Closing Final dari Closing Harian Kasir'
            }).toString()
        });

        if (response.status === 419) {
            throw new Error('Token keamanan kedaluwarsa (419). Refresh halaman lalu ulangi closing.');
        }

        if (!response.ok) {
            let message = `ERP Closing gagal (HTTP ${response.status}).`;
            try {
                const body = await response.text();
                if (body && body.length < 500) message += ` ${body}`;
            } catch (_) {}
            throw new Error(message);
        }

        return response;
    }

    function installSaveClosingBridge() {
        if (typeof window.saveClosing !== 'function' || window.__erpClosingBridgeInstalled) return;
        const legacySaveClosing = window.saveClosing;
        window.__erpClosingBridgeInstalled = true;

        window.saveClosing = async function () {
            const type = document.getElementById('closingType')?.value || 'temporary';

            // Temporary check keeps the old workflow/history. Final closing must pass ERP.
            if (type !== 'final') {
                return legacySaveClosing();
            }

            const physicalText = document.getElementById('closingFisik')?.textContent || 'Rp 0';
            const physical = parseInt(String(physicalText).replace(/[^\d]/g, ''), 10) || 0;
            let erp;
            try {
                erp = await fetchErpSummary();
            } catch (error) {
                alert('Closing Final dihentikan: ERP Ledger belum dapat dibaca. ' + error.message);
                return;
            }

            const difference = physical + Number(erp.hanging_amount || 0) - Number(erp.expected_cash || 0);
            if (difference !== 0) {
                alert(`Closing Final belum dapat dikunci. Selisih ERP = ${typeof formatIdr === 'function' ? formatIdr(difference) : difference}. Periksa Cash Fisik dan Gantungan.`);
                return;
            }

            if (!confirm('ERP menunjukkan BALANCED. Simpan dan kunci Closing Final?')) return;

            try {
                await postFinalClosingToErp();
                if (typeof Swal !== 'undefined') {
                    await Swal.fire({
                        icon: 'success',
                        title: 'Closing Final Berhasil',
                        text: 'Closing sudah tercatat di ERP Ledger sebagai CLOSED / BALANCED.',
                        timer: 1800,
                        showConfirmButton: false
                    });
                } else {
                    alert('Closing Final berhasil dicatat di ERP Ledger.');
                }
                await refreshClosingFromErp();
                if (typeof window.openClosingHistoryModal === 'function') {
                    window.openClosingHistoryModal();
                }
            } catch (error) {
                console.error('[ERP Closing] store gagal:', error);
                alert(error.message || 'Closing Final gagal disimpan ke ERP.');
            }
        };
    }

    function boot() {
        installSaveClosingBridge();
        refreshClosingFromErp();

        document.getElementById('closingDateInput')?.addEventListener('change', refreshClosingFromErp);
        document.getElementById('closingType')?.addEventListener('change', refreshClosingFromErp);

        // Re-try because the SPA can initialize modules after DOMContentLoaded.
        let attempts = 0;
        const timer = setInterval(() => {
            installSaveClosingBridge();
            refreshClosingFromErp();
            attempts += 1;
            if (window.__erpClosingBridgeInstalled || attempts >= 20) clearInterval(timer);
        }, 500);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.refreshClosingFromErp = refreshClosingFromErp;
})();
