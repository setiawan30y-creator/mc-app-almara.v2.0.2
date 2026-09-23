<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InjectClosingBridge
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (!$response->isSuccessful() || !str_contains((string) $response->headers->get('Content-Type'), 'text/html')) {
            return $response;
        }

        $html = $response->getContent();
        $scripts = '<script src="/js/modules/17-erp-closing-bridge.js?v=2cea470"></script>'
            . '<script src="/js/modules/18-closing-harian-status.js?v=9539584"></script>';

        if (!str_contains($html, '18-closing-harian-status.js')) {
            $html = str_replace('</body>', $scripts . '</body>', $html);
            $response->setContent($html);
        }

        return $response;
    }
}
