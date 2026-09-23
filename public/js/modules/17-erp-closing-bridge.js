/*
 * ERP Closing Bridge
 *
 * Closing Harian lama tetap menjadi UI utama.
 * Temporary = simpan draft/count fisik, JANGAN reset denominasi.
 * Final = rekonsiliasi dan posting ke ERP.
 */
(function () {
    'use strict';

    const ERP_SUMMARY_URL = '/erp/closing/summary';
    const ERP_STORE_URL = '/erp/closing';
    const DRAFT_PREFIX = 'almara:closing:draft:';

    const ids = {
        physical: ['closingFisik'],
        expected: ['closingKasSistem'],
        hanging: ['closingGantunganPiutang'],
        expenses: ['closingTotalExpenses'],
        difference: ['closingSelisih'],
        date: ['closingDateInput'],
        type: ['closingType'],
        note: ['closingNote'],
        source: ['closingErpSourceStatus']
    };

    const find = list => {
        for (const id of list) {
            const el = document.getElementById(id);
            if (el) return el;
        }
        return null;
    };

    const money = value => {
        const n = Number(value || 0);
        return typeof formatIdr === 'function' ? formatIdr(n) : `Rp ${n.toLocaleString('id-ID')}`;
    };

    const parseMoney = value => {
        if (value === null || value === undefined || value === '') return 0;
        const negative = String(value).trim().startsWith('-');
        const digits = String(value).replace(/[^0-9]/g, '');
        const n = Number(digits || 0);
        return negative ? -n : n;
    };

    function closingDate() {
        return (find(ids.date)?.value || document.querySelector('[name="closing_date"]')?.value || new Date().toISOString()).slice(0, 10);
    }

    function physicalValue() {
        const el = find(ids.physical);
        if (!el) return 0;
        return parseMoney(el.value !== undefined && el.value !== '' ? el.value : el.textContent);
    }

    function setPhysical(value) {
        const el = find(ids.physical);
        if (!el) return;
        if ('value' in el) el.value = String(Number(value || 0));
        el.dataset.value = String(Number(value || 0));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function draftKey(date = closingDate()) {
        return `${DRAFT_PREFIX}${date}`;
    }

    /*
     * IMPORTANT:
     * The old Closing Harian screen calculates the physical total from the
     * denomination inputs. Its save routine clears those inputs after saving.
     * We therefore snapshot the denomination controls BEFORE saveClosing(),
     * then restore them AFTER saveClosing() finishes.
     */
    function denominationControls() {
        return Array.from(document.querySelectorAll('input, select, textarea')).filter(el => {
            if (!el || el.disabled) return false;
            if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit') return false;

            const key = `${el.id || ''} ${el.name || ''} ${el.className || ''}`.toLowerCase();
            return /(denom|denominasi|pecahan|jumlah|qty|quantity|count|cash)/.test(key);
        });
    }

    function snapshotClosingForm() {
        const controls = denominationControls();
        const values = controls.map((el, index) => ({
            index,
            id: el.id || '',
            name: el.name || '',
            value: el.value,
            checked: el.checked,
            type: el.type
        }));

        return {
            date: closingDate(),
            physical: physicalValue(),
            controls: values,
            savedAt: Date.now()
        };
    }

    function restoreClosingForm(snapshot) {
        if (!snapshot) return;

        const controls = denominationControls();
        snapshot.controls.forEach(item => {
            let el = item.id ? document.getElementById(item.id) : null;
            if (!el && item.name) {
                el = controls.find(x => x.name === item.name && x.type === item.type);
            }
            if (!el) el = controls[item.index];
            if (!el) return;

            if (el.type === 'checkbox' || el.type === 'radio') {
                el.checked = !!item.checked;
            } else {
                el.value = item.value ?? '';
            }
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });

        // Restore the calculated physical total as well. This is deliberately
        // done after the denomination events so the displayed total cannot
        // fall back to zero when the legacy handler resets the form.
        setPhysical(snapshot.physical);

        try {
            localStorage.setItem(draftKey(snapshot.date), JSON.stringify(snapshot));
        } catch (_) {}

        document.dispatchEvent(new CustomEvent('almara:closing-draft-restored', {
            detail: snapshot
        }));
    }

    function loadDraft(date = closingDate()) {
        try {
            const raw = localStorage.getItem(draftKey(date));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (_) {
            return null;
        }
    }

    async function fetchSummary(date = closingDate()) {
        const response = await fetch(`${ERP_SUMMARY_URL}?date=${encodeURIComponent(date)}&ts=${Date.now()}`, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!response.ok) throw new Error(`ERP summary HTTP ${response.status}`);
        const result = await response.json();
        if (result.status !== 'success' || !result.data) throw new Error('Format ERP summary tidak valid.');
        return result.data;
    }

    function renderSummary(data) {
        const expected = Number(data.expected_cash || 0);
        const hanging = Number(data.hanging_amount || 0);
        const draft = loadDraft();
        const physical = draft ? Number(draft.physical || 0) : physicalValue();
        const difference = physical + hanging - expected;

        const expectedEl = find(ids.expected);
        const hangingEl = find(ids.hanging);
        const expenseEl = find(ids.expenses);
        const diffEl = find(ids.difference);

        if (expectedEl) expectedEl.textContent = money(expected);
        if (hangingEl) hangingEl.textContent = money(hanging);
        if (expenseEl) expenseEl.textContent = money(data.expense || 0);

        if (diffEl) {
            diffEl.textContent = difference === 0
                ? money(0)
                : `${difference < 0 ? '-' : '+'}${money(Math.abs(difference))}`;
            diffEl.style.color = difference === 0 ? '#10B981' : difference < 0 ? '#F87171' : '#3B82F6';
        }

        const source = find(ids.source);
        if (source) {
            source.textContent = `ERP Ledger aktif • Expected Cash ${money(expected)} • Gantungan ${money(hanging)}`;
            source.style.color = '#10B981';
        }

        setPhysical(physical);
    }

    async function refresh() {
        try {
            const data = await fetchSummary();
            window.__almaraErpClosingSummary = data;
            renderSummary(data);
            return data;
        } catch (error) {
            console.warn('[ERP Closing]', error);
            return null;
        }
    }

    function csrf() {
        return typeof window.getCsrfToken === 'function'
            ? window.getCsrfToken()
            : document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    }

    async function postFinal() {
        const response = await fetch(ERP_STORE_URL, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json, text/html',
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrf()
            },
            body: new URLSearchParams({
                closing_date: closingDate(),
                physical_cash: String(physicalValue()),
                notes: find(ids.note)?.value || 'Closing Final dari Closing Harian Kasir'
            }).toString()
        });

        if (response.status === 419) throw new Error('Token keamanan kedaluwarsa (419). Refresh halaman lalu ulangi closing.');
        if (!response.ok) throw new Error(`ERP Closing gagal (HTTP ${response.status}).`);
        return response;
    }

    function install() {
        if (window.__erpClosingBridgeInstalled) return true;
        if (typeof window.saveClosing !== 'function') return false;

        const legacySave = window.saveClosing;
        window.__erpClosingBridgeInstalled = true;

        window.saveClosing = async function () {
            const type = find(ids.type)?.value || 'temporary';
            const snapshot = snapshotClosingForm();

            // Temporary: save legacy history, then restore EXACTLY what the
            // cashier counted. The history entry is kept, but the working form
            // remains populated for review/reconciliation.
            if (type !== 'final') {
                try {
                    localStorage.setItem(draftKey(snapshot.date), JSON.stringify(snapshot));
                } catch (_) {}

                const result = await Promise.resolve(legacySave.apply(this, arguments));

                const restore = () => restoreClosingForm(snapshot);
                restore();
                setTimeout(restore, 50);
                setTimeout(restore, 200);
                setTimeout(restore, 500);
                setTimeout(() => {
                    restore();
                    refresh();
                }, 900);

                return result;
            }

            // Final: ERP must be balanced before posting/locking.
            const erp = await fetchSummary();
            const difference = physicalValue() + Number(erp.hanging_amount || 0) - Number(erp.expected_cash || 0);

            if (Math.abs(difference) >= 0.005) {
                alert(`Closing Final belum dapat dikunci. Selisih ERP = ${money(difference)}.`);
                return;
            }

            if (!confirm('ERP menunjukkan BALANCED. Simpan dan kunci Closing Final?')) return;

            try {
                await postFinal();
                localStorage.removeItem(draftKey(closingDate()));
                await refresh();
                alert('Closing Final berhasil dicatat di ERP Ledger.');
                if (typeof window.openClosingHistoryModal === 'function') window.openClosingHistoryModal();
            } catch (error) {
                console.error('[ERP Closing]', error);
                alert(error.message || 'Closing Final gagal disimpan ke ERP.');
            }
        };

        return true;
    }

    function boot() {
        install();

        const draft = loadDraft();
        if (draft) restoreClosingForm(draft);
        refresh();

        let tries = 0;
        const timer = setInterval(() => {
            install();
            const currentDraft = loadDraft();
            if (currentDraft) restoreClosingForm(currentDraft);
            tries++;
            if (window.__erpClosingBridgeInstalled && tries >= 8) clearInterval(timer);
            if (tries >= 30) clearInterval(timer);
        }, 500);
    }

    document.addEventListener('almara:closing-saved', () => {
        const draft = loadDraft();
        if (draft) restoreClosingForm(draft);
        refresh();
    });

    document.addEventListener('almara:closing-updated', () => {
        const draft = loadDraft();
        if (draft) restoreClosingForm(draft);
        refresh();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }

    window.refreshClosingFromErp = refresh;
})();
