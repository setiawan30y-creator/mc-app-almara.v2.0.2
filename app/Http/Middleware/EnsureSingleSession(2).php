<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureSingleSession
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return $next($request);
        }

        $sessionKeyName = 'mc_active_session_token';
        $sessionToken = (string) $request->session()->get($sessionKeyName, '');
        $activeToken = (string) ($user->active_session_token ?? '');

        if ($activeToken === '') {
            $sessionToken = $sessionToken !== '' ? $sessionToken : Str::random(64);
            $request->session()->put($sessionKeyName, $sessionToken);
            $user->forceFill(['active_session_token' => $sessionToken])->save();
            return $next($request);
        }

        if ($sessionToken === '') {
            $sessionToken = (string) $request->session()->getId();
            $request->session()->put($sessionKeyName, $sessionToken);
        }

        if (!hash_equals($activeToken, $sessionToken)) {
            Auth::guard('web')->logout();
            $request->session()->forget($sessionKeyName);
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'status' => 'error',
                'message' => 'Akun ini sedang dipakai di perangkat lain. Silakan login ulang.',
                'code' => 'single_session_conflict',
            ], 423);
        }

        return $next($request);
    }
}
