<?php

namespace App\Http\Controllers;

use App\Services\Erp\PaymentPostingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ErpPaymentController extends Controller
{
    public function store(Request $request, int $transactionId, PaymentPostingService $service): JsonResponse
    {
        $validated = $request->validate([
            'payments' => ['required', 'array', 'min:1'],
            'payments.*.method' => ['required', 'in:cash,bank'],
            'payments.*.amount' => ['required', 'numeric', 'gt:0'],
            'payments.*.currency_code' => ['nullable', 'string', 'max:10'],
            'payments.*.cash_account_id' => ['nullable', 'integer'],
            'payments.*.bank_account_id' => ['nullable', 'integer'],
            'payments.*.reference' => ['nullable', 'string', 'max:255'],
            'payments.*.bank_reference' => ['nullable', 'string', 'max:255'],
            'payments.*.direction' => ['nullable', 'in:in,out'],
            'payments.*.description' => ['nullable', 'string'],
        ]);

        $payments = $service->post($transactionId, $validated['payments'], optional($request->user())->id);

        return response()->json([
            'success' => true,
            'message' => 'Payment posted successfully.',
            'data' => $payments,
        ], 201);
    }
}
