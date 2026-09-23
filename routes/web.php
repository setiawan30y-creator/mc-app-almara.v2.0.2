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
        if (!is_string($decoded)) {
            break;
        }
        $next = json_decode($decoded, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            break;
        }
        $decoded = $next;
    }

    return is_array($decoded) ? $decoded : null;
}

Route::get('/', function () {
    if (auth()->check() && strtolower((string) auth()->user()->role) === 'papan') {
        return redirect('/papan-kurs');
    }

    // Dashboard tetap menggunakan view utama. Tambahkan stylesheet Currency Master
    // setelah seluruh stylesheet dashboard agar override layout modal benar-benar
    // berada di layer terakhir dan tidak tertutup aturan .modal-content lama.
    $html = view('dashboard')->render();
    $currencyMasterCss = '<link rel="stylesheet" href="' . asset('css/currency-master-ui-override.css?v=20260923-2') . '">';
    $iso4217Js = '<script src="' . asset('js/modules/21-iso4217-currency-dropdown.js?v=20260923-1') . '"></script>';
    if (stripos($html, 'currency-master-ui-override.css') === false) {
        $html = str_ireplace('</head>', $currencyMasterCss . "\n</head>", $html);
    }
    if (stripos($html, '21-iso4217-currency-dropdown.js') === false) {
        $html = str_ireplace('</body>', $iso4217Js . "\n</body>", $html);
    }

    return response($html)->header('Content-Type', 'text/html; charset=UTF-8');
})->middleware([DevelopmentBypassAuth::class, InjectClosingBridge::class]);

Route::get('/login', function () {
    return redirect('/');
})->name('login.form');

Route::post('/login', [AuthController::class, 'login'])->name('login');
Route::post('/logout', [AuthController::class, 'logout'])->middleware(['auth', 'single.session'])->name('logout');
Route::get('/auth/me', [AuthController::class, 'me'])->middleware(['auth', 'single.session']);

// ERP Phase 1: atomic payment posting creates the payment and matching ledger movement.
Route::post('/erp/transactions/{transactionId}/payments', [ErpPaymentController::class, 'store'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.transactions.payments.store');

// ERP Cash Control: the legacy Closing Harian UI remains the cashier-facing screen.
Route::get('/erp/closing/summary', [ErpCashClosingController::class, 'summary'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.closing.summary');
Route::get('/erp/closing', [ErpCashClosingController::class, 'index'])
    ->middleware([DevelopmentBypassAuth::class, InjectClosingBridge::class])
    ->name('erp.closing.index');
Route::post('/erp/closing', [ErpCashClosingController::class, 'store'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.closing.store');
Route::get('/erp/gantungan', [ErpCashClosingController::class, 'gantungan'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.index');
Route::post('/erp/gantungan', [ErpCashClosingController::class, 'gantunganStore'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.store');
Route::post('/erp/gantungan/{gantungan}/return', [ErpCashClosingController::class, 'gantunganReturn'])
    ->middleware(DevelopmentBypassAuth::class)
    ->name('erp.gantungan.return');

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
        // Fallback
    }
    return view('papan-kurs', [
        'profile' => $profileData,
        'papanSettings' => $papanSettings,
    ]);
})->middleware(['auth', 'single.session']);
