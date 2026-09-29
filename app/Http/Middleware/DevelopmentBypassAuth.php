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
        // Dashboard inline/application code currently depends on globals such
        // as flatpickr, Swal and jQuery during initialisation. Deferring these
        // tags independently can execute the application code before the
        // libraries exist and lock the UI behind the runtime-error overlay.
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
            $response->setContent($content);
        }

        return $response;
    }
}
