<?php

namespace App\Services\Erp;

use App\Models\ErpCurrencyStock;
use App\Models\ErpCurrencyStockMovement;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class CurrencyStockService
{
    public function post(
        string $currencyCode,
        string $type,
        float $quantity,
        ?string $transactionRef = null,
        ?string $idempotencyKey = null,
        array $metadata = []
    ): ErpCurrencyStockMovement {
        if ($quantity <= 0) {
            throw new RuntimeException('Stock quantity must be greater than zero.');
        }

        $type = strtoupper($type);
        if (!in_array($type, ['IN', 'OUT'], true)) {
            throw new RuntimeException('Stock movement type must be IN or OUT.');
        }

        $idempotencyKey ??= Str::uuid()->toString();

        return DB::transaction(function () use ($currencyCode, $type, $quantity, $transactionRef, $idempotencyKey, $metadata) {
            $existing = ErpCurrencyStockMovement::where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }

            $stock = ErpCurrencyStock::firstOrCreate(
                ['currency_code' => strtoupper($currencyCode)],
                ['quantity' => 0, 'status' => 'active']
            );
            $stock = ErpCurrencyStock::whereKey($stock->id)->lockForUpdate()->firstOrFail();

            $current = (float) $stock->quantity;
            $newBalance = $type === 'IN'
                ? $current + $quantity
                : $current - $quantity;

            if ($newBalance < 0) {
                throw new RuntimeException("Insufficient {$currencyCode} stock.");
            }

            $stock->update(['quantity' => $newBalance]);

            return ErpCurrencyStockMovement::create([
                'movement_ref' => 'STK-' . Str::upper(Str::random(16)),
                'currency_stock_id' => $stock->id,
                'transaction_ref' => $transactionRef,
                'movement_type' => $type,
                'quantity' => $quantity,
                'balance_after' => $newBalance,
                'currency_code' => strtoupper($currencyCode),
                'idempotency_key' => $idempotencyKey,
                'metadata' => $metadata,
                'posted_at' => now(),
            ]);
        }, 3);
    }
}
