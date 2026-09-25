<?php

namespace App\Http\Middleware;

use App\Models\Tenant;
use App\Models\TenantDomain;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TenantSubdomainMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $host = strtolower($request->getHost());

        // Local development:
        // abc.mc-app-almara.v2.0.2.test
        // Production:
        // abc.mc-almara.com
        $domain = TenantDomain::query()
            ->with('tenant')
            ->where('host', $host)
            ->where('status', 'active')
            ->first();

        if ($domain?->tenant?->status === 'active') {
            $request->attributes->set('tenant', $domain->tenant);
            $request->attributes->set('tenant_id', $domain->tenant->id);

            return $next($request);
        }

        /*
         * Fallback untuk domain utama / localhost.
         * Domain utama tidak memilih tenant secara otomatis.
         */
        $request->attributes->set('tenant', null);
        $request->attributes->set('tenant_id', null);

        return $next($request);
    }
}
