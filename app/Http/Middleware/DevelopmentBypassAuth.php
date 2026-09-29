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

        // The dashboard currently loads several third-party JavaScript files
        // in <head>. A slow/unreachable CDN can otherwise block HTML parsing
        // and make the whole local application appear to load forever.
        // Defer only the known external script tags; application bootstrap
        // scripts injected by the route remain in their existing order.
        if (
            $response->headers->get('Content-Type')
            && str_contains($response->headers->get('Content-Type'), 'text/html')
        ) {
            $content = $response->getContent();

            $externalScripts = [
                'https://cdn.jsdelivr.net/npm/chart.js',
                'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
                'https://cdn.jsdelivr.net/npm/flatpickr',
                'https://npmcdn.com/flatpickr/dist/l10n/id.js',
                'https://cdn.jsdelivr.net/npm/sweetalert2@11',
                'https://code.jquery.com/jquery-3.7.1.min.js',
                'https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js',
            ];

            foreach ($externalScripts as $src) {
                $needle = '<script src="' . $src . '"></script>';
                $replacement = '<script src="' . $src . '" defer></script>';
                $content = str_replace($needle, $replacement, $content);
            }

            // The dashboard initializes its UI authentication from localStorage.
            // Seed the same shape only when the explicit local development
            // bypass is enabled.
            if ($enabled) {
                $bootstrap = <<<'HTML'
<script>
(function () {
    try {
        localStorage.setItem('mc_currentUser', JSON.stringify({
            username: 'admin',
            fullName: 'Administrator',
            role: 'owner'
        }));
    } catch (e) {}
})();
</script>
HTML;
                $content = str_replace('</head>', $bootstrap . "\n</head>", $content);
            }

            $response->setContent($content);
        }

        return $response;
    }
}
