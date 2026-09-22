<?php

namespace App\Services\Erp;

use App\Models\ErpBankMovement;
use App\Models\ErpCashMovement;
use App\Models\ErpPayment;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PaymentPostingService
{
    /**
     * Post one or more payments for a transaction and create the matching
     * cash/bank ledger movements atomically.
     *
     * Each payment must contain:
     * method: cash|bank
     * amount: positive numeric amount
     * currency_code: currency of the settlement amount
     * cash_account_id for cash, bank_account_id for bank
     */
    public function post(int $transactionId, array $payments, ?int $userId = null): array
    {
        if ($payments === []) {
            throw ValidationException::withMessages(['payments' => 'At least one payment is required.']);
        }

        return DB::transaction(function () use ($transactionId, $payments, $userId) {
            $posted = [];

            foreach ($payments as $index => $data) {
                $method = strtolower((string) ($data['method'] ?? ''));
                $amount = (float) ($data['amount'] ?? 0);
                $currency = strtoupper((string) ($data['currency_code'] ?? 'IDR'));

                if (!in_array($method, ['cash', 'bank'], true)) {
                    throw ValidationException::withMessages(["payments.$index.method" => 'Payment method must be cash or bank.']);
                }

                if ($amount <= 0) {
                    throw ValidationException::withMessages(["payments.$index.amount" => 'Payment amount must be greater than zero.']);
                }

                $cashId = $method === 'cash' ? ($data['cash_account_id'] ?? null) : null;
                $bankId = $method === 'bank' ? ($data['bank_account_id'] ?? null) : null;

                if ($method === 'cash' && !$cashId) {
                    throw ValidationException::withMessages(["payments.$index.cash_account_id" => 'Cash account is required.']);
                }

                if ($method === 'bank' && !$bankId) {
                    throw ValidationException::withMessages(["payments.$index.bank_account_id" => 'Bank account is required.']);
                }

                $payment = ErpPayment::create([
                    'payment_no' => $this->number('PAY'),
                    'transaction_id' => $transactionId,
                    'method' => $method,
                    'currency_code' => $currency,
                    'amount' => $amount,
                    'cash_account_id' => $cashId,
                    'bank_account_id' => $bankId,
                    'reference' => $data['reference'] ?? null,
                    'status' => 'posted',
                    'paid_at' => now(),
                    'created_by' => $userId,
                ]);

                if ($method === 'cash') {
                    ErpCashMovement::create([
                        'cash_account_id' => $cashId,
                        'movement_no' => $this->number('CSH'),
                        'direction' => $data['direction'] ?? 'in',
                        'amount' => $amount,
                        'currency_code' => $currency,
                        'reference_type' => 'payment',
                        'reference_id' => $payment->id,
                        'description' => $data['description'] ?? 'Transaction payment',
                        'posted_at' => now(),
                        'created_by' => $userId,
                    ]);
                } else {
                    ErpBankMovement::create([
                        'bank_account_id' => $bankId,
                        'movement_no' => $this->number('BNK'),
                        'direction' => $data['direction'] ?? 'in',
                        'amount' => $amount,
                        'currency_code' => $currency,
                        'reference_type' => 'payment',
                        'reference_id' => $payment->id,
                        'bank_reference' => $data['bank_reference'] ?? null,
                        'description' => $data['description'] ?? 'Transaction payment',
                        'posted_at' => now(),
                        'created_by' => $userId,
                    ]);
                }

                $posted[] = $payment->fresh();
            }

            return $posted;
        });
    }

    private function number(string $prefix): string
    {
        return $prefix.'-'.now()->format('YmdHisv').'-'.strtoupper(bin2hex(random_bytes(3)));
    }
}
