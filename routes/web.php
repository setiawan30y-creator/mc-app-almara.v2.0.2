<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ErpCashClosingController;
use App\Http\Controllers\ErpPaymentController;
use App\Http\Middleware\DevelopmentBypassAuth;
use App\Http\Middleware\InjectClosingBridge;
use App\Models\Datastore;
use Illuminate\Support\Facades\Route;

function decodeDatastorePayload($payload)
{
    $decoded = $payload;
    for ($i = 0; $i < 2; $i++) {
        if (!is_string($decoded)) break;
        $next = json_decode($decoded, true);
        if (json_last_error() !== JSON_ERROR_NONE) break;
        $decoded = $next;
    }
    return is_array($decoded) ? $decoded : null;
}

/*
|--------------------------------------------------------------------------
| Dashboard
|--------------------------------------------------------------------------
| Keep this route intentionally simple. Do not render the dashboard to a
| string, rewrite script tags, inject assets, or force defer from the route.
| The Blade view owns the frontend module order. This prevents route-level
| HTML manipulation from breaking JavaScript dependencies and navigation.
*/
Route::get('/', function () {
    if (auth()->check() && strtolower((string) auth()->user()->role) === 'papan') {
        return redirect('/papan-kurs');
    }

    return view('dashboard');
})->middleware([DevelopmentBypassAuth::class]);

Route::get('/settings/theme', function () {
    return view('theme-settings');
})->middleware([DevelopmentBypassAuth::class])->name('settings.theme');

Route::get('/login', function () {
    return redirect('/');
})->name('login.form');

Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])
    ->middleware(['auth', 'single.session'])
    ->name('logout');
Route::get('/auth/me', [AuthController::class, 'me'])
    ->middleware(['auth', 'single.session']);

/* -------------------------------------------------------------------------
 | ERP Payment
 |------------------------------------------------------------------------- */
Route::post('/erp/transactions/{transactionId}/payments', [ErpPaymentController::class, 'store'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.transactions.payments.store');

/* -------------------------------------------------------------------------
 | ERP Cash Closing
 |------------------------------------------------------------------------- */
Route::get('/erp/closing/summary', [ErpCashClosingController::class, 'summary'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.closing.summary');

Route::get('/erp/closing', [ErpCashClosingController::class, 'index'])
    ->middleware([DevelopmentBypassAuth::class, InjectClosingBridge::class])
    ->name('erp.closing.index');

Route::post('/erp/closing', [ErpCashClosingController::class, 'store'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.closing.store');

/* -------------------------------------------------------------------------
 | ERP Gantungan
 |------------------------------------------------------------------------- */
Route::get('/erp/gantungan', [ErpCashClosingController::class, 'gantungan'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.index');

Route::post('/erp/gantungan', [ErpCashClosingController::class, 'gantunganStore'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.store');

Route::post('/erp/gantungan/{gantungan}/return', [ErpCashClosingController::class, 'gantunganReturn'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.return');

/* -------------------------------------------------------------------------
 | Papan Kurs
 |------------------------------------------------------------------------- */
Route::get('/papan-kurs', function () {
    $profileData = null;
    $papanSettings = null;

    try {
        $profileStore = Datastore::where('store_key', 'mc_profile')->first();
        if ($profileStore) {
            $profileData = decodeDatastorePayload($profileStore->json_data);
        }

        $settingsStore = Datastore::where('store_key', 'mc_papan_settings')->first();
        if ($settingsStore) {
            $papanSettings = decodeDatastorePayload($settingsStore->json_data);
        }
    } catch (\Exception $e) {
        // Keep the public board available even when optional datastore data
        // cannot be read.
    }

    return view('papan-kurs', [
        'profile' => $profileData,
        'papanSettings' => $papanSettings,
    ]);
})->middleware(['auth', 'single.session']);
