<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DevelopmentBypassAuth
{
    public function handle(Request $request, Closure $next): Response
    {
        if (app()->environment('local') && config('app.dev_bypass_auth', false)) {
            $request->attributes->set('dev_user', [
                'username' => 'admin',
                'full_name' => 'Administrator',
                'role' => 'owner',
            ]);
        }

        return $next($request);
    }
}
