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
        $script = '<script src="/js/modules/17-erp-closing-bridge.js?v=2cea470"></script>';

        if (!str_contains($html, '17-erp-closing-bridge.js')) {
            $html = str_replace('</body>', $script . '</body>', $html);
            $response->setContent($html);
        }

        return $response;
    }
}
