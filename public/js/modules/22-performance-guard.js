/* MC Almara performance guard */
(function () {
    'use strict';
    if (window.__almaraPerformanceGuardInstalled) return;
    window.__almaraPerformanceGuardInstalled = true;

    /* First paint must not force a full transaction refresh. */
    window.__almaraStartupPhase = true;

    const originalRefreshTransactionsThen = window.refreshTransactionsThen;
    if (typeof originalRefreshTransactionsThen === 'function') {
        window.refreshTransactionsThen = async function (renderFn) {
            if (window.__almaraStartupPhase) {
                try {
                    if (typeof renderFn === 'function') {
                        const result = renderFn();
                        if (result && typeof result.then === 'function') await result;
                    }
                } finally {
                    window.__almaraStartupPhase = false;
                }
                return;
            }
            return originalRefreshTransactionsThen.apply(this, arguments);
        };
    }

    const originalServerTransactions = window.getServerTransactionsLikeRwt;
    if (typeof originalServerTransactions === 'function') {
        window.__almaraOriginalServerTransactionsLikeRwt = originalServerTransactions;
        window.getServerTransactionsLikeRwt = async function () {
            if (window.__almaraStartupPhase) {
                return window.AlmaraApp?.store?.getTransactions?.() || [];
            }
            return originalServerTransactions.apply(this, arguments);
        };
    }

    const idle = window.requestIdleCallback || function (cb) {
        return window.setTimeout(function () { cb({ timeRemaining: function () { return 0; } }); }, 1200);
    };

    function delayed(original, delay, key) {
        return function () {
            const args = arguments;
            window.__almaraPerfJobs = window.__almaraPerfJobs || {};
            if (window.__almaraPerfJobs[key]) return Promise.resolve({ skipped: true });
            window.__almaraPerfJobs[key] = true;
            return new Promise(function (resolve) {
                idle(function () {
                    window.setTimeout(function () {
                        Promise.resolve().then(function () { return original.apply(window, args); })
                            .then(resolve)
                            .catch(function (error) {
                                console.warn('[PerfGuard] sync job failed:', key, error);
                                resolve({ ok: false, error: error });
                            })
                            .finally(function () { window.__almaraPerfJobs[key] = false; });
                    }, delay);
                });
            });
        };
    }

    let guarded = false;
    function armSyncGuard() {
        if (guarded) return true;
        const originals = {
            currencies: window.syncFromMySQL_Currencies,
            transactions: window.syncFromMySQL_Transactions,
            customers: window.syncFromMySQL_Customers,
            datastore: window.syncUniversalDatastore
        };
        const ready = typeof originals.currencies === 'function' ||
            typeof originals.transactions === 'function' ||
            typeof originals.customers === 'function' ||
            typeof originals.datastore === 'function';
        if (!ready) return false;

        window.__almaraOriginalSync = originals;
        if (typeof originals.currencies === 'function' && !originals.currencies.__almaraGuarded) {
            const fn = delayed(originals.currencies, 3500, 'currencies');
            fn.__almaraGuarded = true;
            window.syncFromMySQL_Currencies = fn;
        }
        if (typeof originals.transactions === 'function' && !originals.transactions.__almaraGuarded) {
            const fn = delayed(originals.transactions, 5000, 'transactions');
            fn.__almaraGuarded = true;
            window.syncFromMySQL_Transactions = fn;
        }
        if (typeof originals.customers === 'function' && !originals.customers.__almaraGuarded) {
            const fn = delayed(originals.customers, 6500, 'customers');
            fn.__almaraGuarded = true;
            window.syncFromMySQL_Customers = fn;
        }
        if (typeof originals.datastore === 'function' && !originals.datastore.__almaraGuarded) {
            const fn = delayed(originals.datastore, 8000, 'datastore');
            fn.__almaraGuarded = true;
            window.syncUniversalDatastore = fn;
        }
        guarded = true;
        console.info('[PerfGuard] UI-first startup mode active.');
        return true;
    }

    armSyncGuard();
    let attempts = 0;
    const retryTimer = window.setInterval(function () {
        attempts++;
        if (armSyncGuard() || attempts >= 80) window.clearInterval(retryTimer);
    }, 50);

    /* Release startup phase after the first render. */
    window.setTimeout(function () {
        window.__almaraStartupPhase = false;
    }, 1500);

    let errorCount = 0;
    window.onerror = function (message, source, line, column, error) {
        errorCount++;
        if (errorCount <= 8) console.error('[MC Almara startup]', message, source, line, column, error);
        return true;
    };

    function releaseKnownLoadingState() {
        ['#global-loading-overlay','#loadingOverlay','#appLoadingOverlay','.app-loading-overlay'].forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                if (el && !el.classList.contains('show') && !el.dataset.keepVisible) el.style.pointerEvents = 'none';
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.setTimeout(releaseKnownLoadingState, 100);
        }, { once: true });
    } else {
        window.setTimeout(releaseKnownLoadingState, 100);
    }
})();
