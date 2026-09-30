/* MC Almara performance guard */
(function () {
    'use strict';
    if (window.__almaraPerformanceGuardInstalled) return;
    window.__almaraPerformanceGuardInstalled = true;

    /* First paint must not parse/render the complete transaction dataset. */
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
                return [];
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

    /*
     * CRITICAL: sync.js starts a 4-second realtime loop immediately when it is
     * evaluated. That loop performs four network pulls and can refresh the active
     * dashboard on every tick. If any response is large, the browser main thread
     * is repeatedly forced to parse JSON, scan localStorage and rerender tables.
     * Stop that loop before it can run again, then replace it with a low-frequency
     * background sync that never rerenders the active page.
     */
    if (typeof window.stopAlmaraRealtimeSync === 'function') {
        window.stopAlmaraRealtimeSync();
    }

    const legacyStartRealtimeSync = window.startAlmaraRealtimeSync;
    window.startAlmaraRealtimeSync = function () {
        if (window.__almaraSafeRealtimeTimer) return;
        if (typeof legacyStartRealtimeSync !== 'function') return;

        const runBackgroundSync = async function () {
            if (window.__almaraRealtimeSyncBusy) return;
            window.__almaraRealtimeSyncBusy = true;
            try {
                await syncFromMySQL_Transactions({ pushLocal: false, refreshUi: false, silent: true });
                await syncFromMySQL_Currencies({ refreshUi: false, silent: true });
                await syncFromMySQL_Customers({ refreshUi: false, silent: true });
                await syncUniversalDatastore({ preferRemote: true, refreshUi: false, silent: true });
            } catch (error) {
                console.warn('[PerfGuard] background sync failed:', error);
            } finally {
                window.__almaraRealtimeSyncBusy = false;
            }
        };

        /* Give the dashboard a quiet startup window. */
        window.__almaraSafeRealtimeTimer = window.setTimeout(function () {
            window.__almaraSafeRealtimeTimer = window.setInterval(runBackgroundSync, 60000);
            runBackgroundSync();
        }, 15000);

        window.__transactionRealtimeSyncStarted = true;
        window.__globalRealtimeSyncStarted = true;
        console.info('[PerfGuard] safe realtime sync: first run 15s, interval 60s, no UI refresh.');
    };

    window.stopAlmaraRealtimeSync = function () {
        if (window.__almaraSafeRealtimeTimer) {
            clearTimeout(window.__almaraSafeRealtimeTimer);
            clearInterval(window.__almaraSafeRealtimeTimer);
            window.__almaraSafeRealtimeTimer = null;
        }
        window.__transactionRealtimeSyncStarted = false;
        window.__globalRealtimeSyncStarted = false;
        if (typeof window.__almaraLegacyRealtimeStop === 'function') {
            window.__almaraLegacyRealtimeStop();
        }
    };

    /* The old loop has already been stopped above. Do not start it again here. */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            window.setTimeout(releaseKnownLoadingState, 100);
        }, { once: true });
    } else {
        window.setTimeout(releaseKnownLoadingState, 100);
    }
})();
