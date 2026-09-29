<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DevelopmentBypassAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        // Never allow the development login bypass outside local development.
        $enabled = app()->environment('local')
            && (bool) config('app.dev_bypass_auth', false);

        $devUser = [
            'username' => 'admin',
            'full_name' => 'Administrator',
            'role' => 'owner',
        ];

        if ($enabled) {
            $request->attributes->set('dev_user', $devUser);
        }

        $response = $next($request);

        // Keep third-party libraries in their original execution order.
        // The dashboard currently expects globals such as flatpickr, Swal and
        // jQuery during bootstrap. Do not defer those dependencies here.
        if (
            $enabled
            && $response->headers->get('Content-Type')
            && str_contains($response->headers->get('Content-Type'), 'text/html')
        ) {
            $content = $response->getContent();

            // The dashboard initializes its UI authentication from localStorage.
            // Seed the same shape only when the explicit local development
            // bypass is enabled.
            $bootstrap = <<<'HTML'
<style>
/* A diagnostic banner must never become an invisible click-blocking layer. */
#visual-error-logger { pointer-events: none !important; }
#visual-error-logger button { pointer-events: auto !important; }
</style>
<script>
(function () {
    try {
        localStorage.setItem('mc_currentUser', JSON.stringify({
            username: 'admin',
            fullName: 'Administrator',
            role: 'owner'
        }));
    } catch (e) {}

    // CDN failure must not abort the whole application. Flatpickr is a
    // convenience date-picker; native <input type="date"> is a safe fallback.
    // Only install the fallback when the real library was not loaded.
    if (typeof window.flatpickr !== 'function') {
        var fallbackFlatpickr = function (target, options) {
            options = options || {};
            var nodes = [];
            try {
                if (typeof target === 'string') {
                    nodes = Array.prototype.slice.call(document.querySelectorAll(target));
                } else if (target && target.nodeType === 1) {
                    nodes = [target];
                } else if (target && typeof target.length === 'number') {
                    nodes = Array.prototype.slice.call(target);
                }
            } catch (e) {}

            nodes.forEach(function (el) {
                if (!el) return;
                if (el.tagName === 'INPUT' && el.type === 'text') {
                    try { el.type = 'date'; } catch (e) {}
                }
                if (options.defaultDate && !el.value) {
                    try {
                        var value = options.defaultDate instanceof Date
                            ? options.defaultDate.toISOString().slice(0, 10)
                            : String(options.defaultDate).slice(0, 10);
                        el.value = value;
                    } catch (e) {}
                }
            });

            return {
                element: nodes[0] || null,
                selectedDates: [],
                config: options,
                setDate: function (value) {
                    nodes.forEach(function (el) {
                        try { el.value = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10); } catch (e) {}
                    });
                },
                clear: function () { nodes.forEach(function (el) { try { el.value = ''; } catch (e) {} }); },
                open: function () { nodes.forEach(function (el) { try { el.showPicker ? el.showPicker() : el.focus(); } catch (e) {} }); },
                close: function () {},
                destroy: function () {},
                set: function () {}
            };
        };
        fallbackFlatpickr.l10ns = { id: {} };
        fallbackFlatpickr.localize = function () {};
        window.flatpickr = fallbackFlatpickr;
    }
})();
</script>
HTML;
            $content = str_replace('</head>', $bootstrap . "\n</head>", $content);
            $response->setContent($content);
        }

        return $response;
    }
}