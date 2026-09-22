<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DevelopmentBypassAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        $enabled = app()->environment('local')
            && filter_var(env('DEV_BYPASS_AUTH', false), FILTER_VALIDATE_BOOLEAN);

        if (!$enabled) {
            return $next($request);
        }

        $request->attributes->set('dev_user', [
            'username' => 'admin',
            'full_name' => 'Administrator',
            'role' => 'owner',
        ]);

        $response = $next($request);

        // Dashboard authenticates its initial UI state from localStorage.
        // In local development only, seed a virtual owner identity so the
        // developer can inspect the application without a database login.
        if ($response->headers->get('Content-Type') && str_contains($response->headers->get('Content-Type'), 'text/html')) {
            $content = $response->getContent();
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
