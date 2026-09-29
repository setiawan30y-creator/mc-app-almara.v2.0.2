/* MC Almara performance guard
 * Loaded after the normal frontend modules and before DOMContentLoaded.
 * The existing sync.js registers DOMContentLoaded handlers very early; replacing
 * the global sync functions here lets those handlers remain compatible while
 * moving expensive network/storage work off the initial render path.
 */
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
                        Promise.resolve().then(function () {
                            return original.apply(window, args);
                        }).then(resolve).catch(function (error) {
                            console.warn('[PerfGuard] sync job failed:', key, error);
                            resolve({ ok: false, error: error });
                        }).finally(function () {
                            window.__almaraPerfJobs[key] = false;
                        });
                    }, delay);
                });
            });
        };
    }

    // Save original implementations once. They are still available and can
    // be used by manual refresh actions elsewhere in the application.
    const originals = {
        currencies: window.syncFromMySQL_Currencies,
        transactions: window.syncFromMySQL_Transactions,
        customers: window.syncFromMySQL_Customers,
        datastore: window.syncUniversalDatastore
    };

    window.__almaraOriginalSync = originals;

    if (typeof originals.currencies === 'function') {
        window.syncFromMySQL_Currencies = delayed(originals.currencies, 2500, 'currencies');
    }
    if (typeof originals.transactions === 'function') {
        window.syncFromMySQL_Transactions = delayed(originals.transactions, 3500, 'transactions');
    }
    if (typeof originals.customers === 'function') {
        window.syncFromMySQL_Customers = delayed(originals.customers, 4500, 'customers');
    }
    if (typeof originals.datastore === 'function') {
        window.syncUniversalDatastore = delayed(originals.datastore, 5500, 'datastore');
    }

    // Avoid the debug logger becoming a network request amplifier when a module
    // throws repeatedly during startup. Keep the first few errors in console.
    let errorCount = 0;
    const previousOnError = window.onerror;
    window.onerror = function (message, source, line, column, error) {
        errorCount++;
        if (errorCount <= 5) {
            console.error('[MC Almara startup]', message, source, line, column, error);
        }
        // Do not send a fetch from the global error handler. A failing error
        // logger must never participate in the application's runtime loop.
        if (typeof previousOnError === 'function' && errorCount <= 5) {
            try { return previousOnError(message, source, line, column, error); } catch (_) {}
        }
        return true;
    };

    // If an old overlay/loading element is left by a failed module, only repair
    // known loading IDs/classes. Never scan the whole DOM on a timer.
    function releaseKnownLoadingState() {
        const selectors = [
            '#global-loading-overlay',
            '#loadingOverlay',
            '#appLoadingOverlay',
            '.app-loading-overlay'
        ];
        selectors.forEach(function (selector) {
            document.querySelectorAll(selector).forEach(function (el) {
                if (el && !el.classList.contains('show') && !el.dataset.keepVisible) {
                    el.style.pointerEvents = 'none';
                }
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
