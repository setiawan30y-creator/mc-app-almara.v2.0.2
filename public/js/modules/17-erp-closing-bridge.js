/*
 * ERP Closing Bridge
 *
 * Keeps the existing cashier-facing Closing Harian screen as the UI,
 * while ERP Ledger is the source of truth for Expected Cash + Gantungan.
 *
 * Important: the legacy Closing Harian screen is not required to have a
 * #closing-view wrapper. Older builds use different DOM structures, so this
 * bridge deliberately works by field IDs and saveClosing() instead of a
 * specific page container.
 */
(function () {
    'use strict';

    const ERP_SUMMARY_URL = '/erp/closing/summary';
    const ERP_STORE_URL = '/erp/closing';

    const FIELD_IDS = {
        kasSistem: ['closingKasSistem'],
        gantunganPiutang: ['closingGantunganPiutang'],
        gantunganUtang: ['closingGantunganUtang'],
        expenses: ['closingTotalExpenses'],
        physical: ['closingFisik'],
        difference: ['closingSelisih'],
        source: ['closingErpSourceStatus'],
        date: ['closingDateInput'],
        type: ['closingType'],
        note: ['closingNote']
    };

    function findByIds(ids) {
        for (const id of ids) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    }

    function csrfToken() {
        return typeof window.getCsrfToken === 'function'
            ? window.getCsrfToken()
            : (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');
    }

    function selectedClosingDate() {
        const el = findByIds(FIELD_IDS.date)
            || document.querySelector('input[name="closing_date"]')
            || document.querySelector('[data-closing-date]');

        const value = el?.value || el?.dataset?.closingDate;
        return value?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    }

    function formatMoney(value) {
        const n = Number(value || 0);
        return typeof formatIdr === 'function'
            ? formatIdr(n)
            : `Rp ${n.toLocaleString('id-ID')}`;
    }

    function setText(idOrIds, value) {
        const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
        const el = findByIds(ids);
        if (el) el.textContent = formatMoney(value);
        return el;
    }

    function parseMoney(value) {
        if (value === null || value === undefined) return 0;
        const raw = String(value).trim();
        if (!raw) return 0;
        const negative = /^\s*-/.test(raw);
        const digits = raw.replace(/[^0-9]/g, '');
        const amount = Number(digits || 0);
        return negative ? -amount : amount;
    }

    function readPhysicalCash() {
        const el = findByIds(FIELD_IDS.physical);
        if (el) {
            // Prefer a numeric value stored on the element, then its text.
            const direct = el.value ?? el.dataset?.value;
            if (direct !== undefined && direct !== '') return parseMoney(direct);
            return parseMoney(el.textContent);
        }

        // Fallbacks for older Closing Harian variants.
        const candidates = [
            '[data-closing-physical]',
            '[data-closing-fisik]',
            '#totalCashFisik',
            '#totalCashPhysical'
        ];
        for (const selector of candidates) {
            const node = document.querySelector(selector);
            if (node) return parseMoney(node.value ?? node.textContent);
        }
        return 0;
    }

    function closingUiExists() {
        return !!(
            findByIds(FIELD_IDS.physical) ||
            findByIds(FIELD_IDS.kasSistem) ||
            findByIds(FIELD_IDS.difference) ||
            findByIds(FIELD_IDS.date) ||
            document.querySelector('[data-closing-harian]')
        );
    }

    async function fetchErpSummary(date = selectedClosingDate()) {
        const response = await fetch(`${ERP_SUMMARY_URL}?date=${encodeURIComponent(date)}&ts=${Date.now()}`, {
            method: 'GET',
            credentials: 'same-origin',
            headers: {
                'Accept': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            },
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`ERP summary HTTP ${response.status}`);

        const result = await response.json();
        if (result.status !== 'success' || !result.data) {
            throw new Error('Format ERP summary tidak valid.');
        }
        return result.data;
    }

    function renderErpSummary(data) {
        window.__almaraErpClosingSummary = data;

        setText(FIELD_IDS.kasSistem, data.expected_cash);
        setText(FIELD_IDS.gantunganPiutang, Math.max(0, Number(data.hanging_amount || 0)));
        setText(FIELD_IDS.gantunganUtang, 0);
        setText(FIELD_IDS.expenses, data.expense);

        const physical = readPhysicalCash();
        const expected = Number(data.expected_cash || 0);
        const hanging = Number(data.hanging_amount || 0);
        const difference = physical + hanging - expected;

        const diffNode = findByIds(FIELD_IDS.difference);
        if (diffNode) {
            diffNode.textContent = difference === 0
                ? formatMoney(0)
                : `${difference < 0 ? '-' : '+'}${formatMoney(Math.abs(difference)).replace(/^[-+]/, '')}`;
            diffNode.style.color = difference === 0 ? '#10B981' : difference < 0 ? '#F87171' : '#3B82F6';
        }

        const sourceNode = findByIds(FIELD_IDS.source);
        if (sourceNode) {
            sourceNode.textContent = `ERP Ledger aktif • Expected Cash ${formatMoney(expected)} • Gantungan ${formatMoney(hanging)}`;
            sourceNode.style.color = '#10B981';
        }

        // Notify other legacy UI modules without coupling them to this bridge.
        document.dispatchEvent(new CustomEvent('almara:erp-closing-refreshed', {
            detail: { ...data, physical_cash: physical, accounted_cash: physical + hanging, difference }
        }));
    }

    async function refreshClosingFromErp(force = false) {
        if (!force && !closingUiExists()) return null;

        try {
            const data = await fetchErpSummary();
            renderErpSummary(data);
            return data;
        } catch (error) {
            console.warn('[ERP Closing] Gagal mengambil summary ERP:', error);
            const sourceNode = findByIds(FIELD_IDS.source);
            if (sourceNode) {
                sourceNode.textContent = 'ERP Ledger belum tersambung — angka lokal tidak dianggap final.';
                sourceNode.style.color = '#F59E0B';
            }
            return null;
        }
    }

    async function postFinalClosingToErp() {
        const physicalCash = readPhysicalCash();
        const closingDate = selectedClosingDate();
        const noteNode = findByIds(FIELD_IDS.note);
        const notes = noteNode?.value || '';

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
            const type = findByIds(FIELD_IDS.type)?.value || 'temporary';

            // Temporary save remains owned by the legacy workflow. We still refresh
            // the ERP numbers afterwards so the screen never displays stale ERP data.
            if (type !== 'final') {
                const result = await legacySaveClosing.apply(this, arguments);
                setTimeout(() => refreshClosingFromErp(true), 150);
                return result;
            }

            const physical = readPhysicalCash();
            let erp;

            try {
                erp = await fetchErpSummary();
            } catch (error) {
                alert('Closing Final dihentikan: ERP Ledger belum dapat dibaca. ' + error.message);
                return;
            }

            const difference = physical + Number(erp.hanging_amount || 0) - Number(erp.expected_cash || 0);
            if (Math.abs(difference) >= 0.005) {
                alert(`Closing Final belum dapat dikunci. Selisih ERP = ${formatMoney(difference)}. Periksa Cash Fisik dan Gantungan.`);
                return;
            }

            if (!confirm('ERP menunjukkan BALANCED. Simpan dan kunci Closing Final?')) return;

            try {
                await postFinalClosingToErp();
                await refreshClosingFromErp(true);

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
        refreshClosingFromErp(true);

        findByIds(FIELD_IDS.date)?.addEventListener('change', () => refreshClosingFromErp(true));
        findByIds(FIELD_IDS.type)?.addEventListener('change', () => refreshClosingFromErp(true));

        // Legacy Closing Harian may initialize after the main DOM is ready.
        // Retry briefly and refresh when its save function becomes available.
        let attempts = 0;
        const timer = setInterval(() => {
            installSaveClosingBridge();
            if (closingUiExists()) refreshClosingFromErp(true);
            attempts += 1;
            if (window.__erpClosingBridgeInstalled && attempts >= 8) clearInterval(timer);
            if (attempts >= 30) clearInterval(timer);
        }, 500);
    }

    document.addEventListener('almara:closing-saved', () => refreshClosingFromErp(true));
    document.addEventListener('almara:closing-updated', () => refreshClosingFromErp(true));

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.refreshClosingFromErp = () => refreshClosingFromErp(true);
})();
