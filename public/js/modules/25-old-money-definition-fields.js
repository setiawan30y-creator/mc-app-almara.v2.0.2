(function () {
    'use strict';

    const COUNTRY_ID = 'modalOldItemCountry';
    const DENOM_ID = 'modalOldItemDenomination';
    const CODE_ID = 'modalOldItemCode';
    const DESC_ID = 'modalOldItemDesc';
    const ITEM_ID = 'modalOldItemId';
    const STOCK_KEY = 'mc_old_money_stock';
    let initialized = false;

    const readJson = (key, fallback = []) => {
        try {
            const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
            return value;
        } catch (_) { return fallback; }
    };

    const writeJson = (key, value) => {
        localStorage.setItem(key, JSON.stringify(value));
        try {
            if (typeof window.pushToUniversalDatastore === 'function') {
                window.pushToUniversalDatastore(key, value);
            }
        } catch (_) {}
    };

    function addStyles() {
        if (document.getElementById('almara-old-money-definition-style')) return;
        const style = document.createElement('style');
        style.id = 'almara-old-money-definition-style';
        style.textContent = `
            #${COUNTRY_ID}, #${DENOM_ID} { min-height: 40px; }
            .almara-old-money-help { display:block; margin-top:5px; font-size:.76rem; color:#64748b; }
            .almara-old-money-definition-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            @media(max-width:700px){ .almara-old-money-definition-grid{grid-template-columns:1fr;} }
        `;
        document.head.appendChild(style);
    }

    function makeField(id, label, type, placeholder) {
        const wrap = document.createElement('div');
        wrap.className = 'form-group';
        wrap.dataset.almaraOldMoneyField = id;
        wrap.innerHTML = `
            <label for="${id}">${label}</label>
            <input type="${type}" id="${id}" class="form-control" placeholder="${placeholder}">
        `;
        return wrap;
    }

    function ensureFields() {
        const modal = document.getElementById('oldMoneyItemModal');
        const code = document.getElementById(CODE_ID);
        const desc = document.getElementById(DESC_ID);
        if (!modal || !code || !desc) return false;

        addStyles();

        if (!document.getElementById(COUNTRY_ID) || !document.getElementById(DENOM_ID)) {
            const grid = document.createElement('div');
            grid.className = 'almara-old-money-definition-grid';
            grid.dataset.almaraOldMoneyFields = '1';
            grid.appendChild(makeField(COUNTRY_ID, 'Negara', 'text', 'Contoh: Jepang, Amerika Serikat'));
            grid.appendChild(makeField(DENOM_ID, 'Denom / Pecahan', 'number', 'Contoh: 100 atau 0.50'));

            const codeGroup = code.closest('.form-group');
            if (codeGroup && codeGroup.parentElement) {
                codeGroup.parentElement.insertBefore(grid, codeGroup);
            } else {
                modal.querySelector('.modal-content')?.appendChild(grid);
            }
        }

        const descLabel = desc.closest('.form-group')?.querySelector('label');
        if (descLabel) descLabel.textContent = 'Nama Spesifik';
        desc.placeholder = 'Opsional: 100 Yen Coin / Federal Reserve Note / seri khusus';
        return true;
    }

    function getFields() {
        return {
            country: String(document.getElementById(COUNTRY_ID)?.value || '').trim(),
            denomination: Number(document.getElementById(DENOM_ID)?.value || 0),
            code: String(document.getElementById(CODE_ID)?.value || '').trim().toUpperCase(),
            specificName: String(document.getElementById(DESC_ID)?.value || '').trim(),
            id: String(document.getElementById(ITEM_ID)?.value || '').trim()
        };
    }

    function setFields(data) {
        const value = data || {};
        const country = value.country || value.negara || '';
        const denom = value.denomination ?? value.denom ?? value.nominal ?? '';
        const specific = value.specificName || value.namaSpesifik || value.desc || value.description || '';
        const countryEl = document.getElementById(COUNTRY_ID);
        const denomEl = document.getElementById(DENOM_ID);
        const descEl = document.getElementById(DESC_ID);
        if (countryEl) countryEl.value = country;
        if (denomEl) denomEl.value = denom || '';
        if (descEl && specific) descEl.value = specific;
    }

    function findStockItem(fields) {
        const stock = readJson(STOCK_KEY, []);
        if (!Array.isArray(stock)) return { stock: [], index: -1 };
        let index = -1;
        if (fields.id) index = stock.findIndex(item => String(item?.id || '') === fields.id);
        if (index < 0 && fields.code) {
            index = stock.findIndex(item => String(item?.code || '').toUpperCase() === fields.code && (
                fields.denomination > 0 ? Number(item?.denomination ?? item?.denom ?? item?.nominal ?? 0) === fields.denomination : true
            ));
        }
        return { stock, index };
    }

    function persistAfterExistingSave(fields) {
        const result = findStockItem(fields);
        if (result.index < 0) return;
        const item = { ...result.stock[result.index] };
        item.country = fields.country;
        item.negara = fields.country;
        item.denomination = fields.denomination > 0 ? fields.denomination : null;
        item.denom = fields.denomination > 0 ? fields.denomination : null;
        item.specificName = fields.specificName;
        item.namaSpesifik = fields.specificName;
        item.desc = fields.specificName;
        result.stock[result.index] = item;
        writeJson(STOCK_KEY, result.stock);
    }

    function wrapSave() {
        if (window.__almaraOldMoneySaveWrapped || typeof window.saveOldMoneyItem !== 'function') return;
        const original = window.saveOldMoneyItem;
        window.saveOldMoneyItem = async function (...args) {
            const fields = getFields();
            const result = original.apply(this, args);
            if (result && typeof result.then === 'function') await result;
            persistAfterExistingSave(fields);
            return result;
        };
        window.__almaraOldMoneySaveWrapped = true;
    }

    function wrapOpenIfAvailable() {
        const names = ['openOldMoneyItemModal', 'editOldMoneyItem', 'openOldMoneyEditModal'];
        names.forEach(name => {
            const fn = window[name];
            if (typeof fn !== 'function' || fn.__almaraOldMoneyFieldsWrapped) return;
            const wrapped = function (...args) {
                const result = fn.apply(this, args);
                window.setTimeout(() => {
                    ensureFields();
                    const fields = getFields();
                    if (fields.id) {
                        const item = readJson(STOCK_KEY, []).find(x => String(x?.id || '') === fields.id);
                        if (item) setFields(item);
                    }
                }, 0);
                return result;
            };
            wrapped.__almaraOldMoneyFieldsWrapped = true;
            wrapped.__almaraOldMoneyOriginal = fn;
            window[name] = wrapped;
        });
    }

    function bindModal() {
        const modal = document.getElementById('oldMoneyItemModal');
        if (!modal || modal.dataset.almaraOldMoneyFieldsBound === '1') return;
        modal.dataset.almaraOldMoneyFieldsBound = '1';
        new MutationObserver(() => {
            ensureFields();
            wrapSave();
            wrapOpenIfAvailable();
        }).observe(modal, { childList: true, subtree: true, attributes: true });
    }

    function boot() {
        ensureFields();
        wrapSave();
        wrapOpenIfAvailable();
        bindModal();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
    window.setTimeout(boot, 500);
    window.setTimeout(boot, 1500);
    window.setTimeout(boot, 3000);

    window.AlmaraOldMoneyDefinition = {
        getFields,
        setFields,
        ensureFields,
        persistAfterExistingSave
    };
})();
