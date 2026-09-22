<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\DatastoreController;
use App\Http\Controllers\SmartdealController;
use App\Http\Controllers\UploadController;
use App\Http\Controllers\AiChatController;
use App\Http\Controllers\UserChatController;
use App\Http\Controllers\OcrController;
use App\Http\Controllers\WhatsAppGatewayController;
use Illuminate\Support\Facades\Route;

Route::middleware(['web', 'auth', 'single.session'])->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::put('/me', [AuthController::class, 'updateMe']);
    Route::post('/branding/favicon', [AuthController::class, 'uploadFavicon'])->middleware('role:owner,superadmin');
    Route::post('/ai/chat', [AiChatController::class, 'chat']);
    Route::get('/users', [AuthController::class, 'users']);
    Route::post('/users', [AuthController::class, 'saveUser']);
    Route::delete('/users/{user}', [AuthController::class, 'deleteUser']);

    // Chat Antar Pengguna Endpoints
    Route::get('/user-chats/messages', [UserChatController::class, 'getMessages']);
    Route::post('/user-chats/messages', [UserChatController::class, 'sendMessage']);
    Route::get('/user-chats/users', [UserChatController::class, 'getChatUsers']);
    Route::get('/user-chats/poll', [UserChatController::class, 'pollNewMessages']);

    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::post('/transactions/bulk', [TransactionController::class, 'bulkStore']);
    Route::delete('/transactions', [TransactionController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/transactions/clear-all', [TransactionController::class, 'clearAll'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::get('/audit', [TransactionController::class, 'audit']);

    Route::get('/customers', [CustomerController::class, 'index']);
    Route::post('/customers', [CustomerController::class, 'store']);
    Route::post('/customers/bulk', [CustomerController::class, 'bulkStore']);
    Route::post('/customers/clear-all', [CustomerController::class, 'clearAll'])->middleware('role:owner,superadmin');
    Route::delete('/customers', [CustomerController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');
    Route::delete('/customers/clear-all', [CustomerController::class, 'clearAll'])->middleware('role:owner,superadmin');

    Route::get('/currencies', [CurrencyController::class, 'index']);
    Route::post('/currencies', [CurrencyController::class, 'store']);
    Route::delete('/currencies', [CurrencyController::class, 'destroy'])->middleware('role:owner,superadmin,admin,supervisor');

    Route::get('/smartdeal-rates', [SmartdealController::class, 'rates']);

    Route::post('/uploads', [UploadController::class, 'store']);
    Route::post('/ocr/vision', [OcrController::class, 'vision']);
    Route::post('/wa-gateway/send', [WhatsAppGatewayController::class, 'send']);

    Route::get('/datastore', [DatastoreController::class, 'index']);
    Route::post('/datastore', [DatastoreController::class, 'store']);
    Route::delete('/datastore', [DatastoreController::class, 'destroy']);
});

Route::get('/public/currencies', [App\Http\Controllers\CurrencyController::class, 'index']);
