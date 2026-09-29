/* MC Almara performance guard */
(function () {
    'use strict';
    if (window.__almaraPerformanceGuardInstalled) return;
    window.__almaraPerformanceGuardInstalled = true;

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

    const originals = {
        currencies: window.syncFromMySQL_Currencies,
        transactions: window.syncFromMySQL_Transactions,
        customers: window.syncFromMySQL_Customers,
        datastore: window.syncUniversalDatastore
    };
    window.__almaraOriginalSync = originals;

    if (typeof originals.currencies === 'function') window.syncFromMySQL_Currencies = delayed(originals.currencies, 2500, 'currencies');
    if (typeof originals.transactions === 'function') window.syncFromMySQL_Transactions = delayed(originals.transactions, 3500, 'transactions');
    if (typeof originals.customers === 'function') window.syncFromMySQL_Customers = delayed(originals.customers, 4500, 'customers');
    if (typeof originals.datastore === 'function') window.syncUniversalDatastore = delayed(originals.datastore, 5500, 'datastore');

    // The old inline error handler POSTs to /debug_logger.php for every error.
    // During a startup failure that can become a request/error feedback loop.
    // Keep errors in console only during bootstrap.
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
        document.addEventListener('DOMContentLoaded', function () { window.setTimeout(releaseKnownLoadingState, 100); }, { once: true });
    } else {
        window.setTimeout(releaseKnownLoadingState, 100);
    }
})();
