<?php

namespace App\Services;

use App\Models\Currency;
use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpCurrencyStock;
use App\Models\ErpPayment;
use App\Models\ErpSettlement;
use App\Models\Transaction;
use Illuminate\Support\Facades\DB;

class DashboardService
{
    public function summary(?string $date = null): array
    {
        $targetDate = $date ?: now()->toDateString();

        $cash = $this->accountBalance(ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->get());
        $bank = $this->accountBalance(ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->get());
        $bca = $this->accountBalance(ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->where(function ($q) {
            $q->where('bank_name', 'like', '%BCA%')->orWhere('code', 'like', '%BCA%');
        })->get());
        $mandiri = $this->accountBalance(ErpBankAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->where(function ($q) {
            $q->where('bank_name', 'like', '%MANDIRI%')->orWhere('code', 'like', '%MANDIRI%');
        })->get());

        $paymentsToday = ErpPayment::query()
            ->where('status', 'posted')
            ->whereDate('paid_at', $targetDate);

        $paymentIn = (float) (clone $paymentsToday)->where('direction', 'in')->sum('amount');
        $paymentOut = (float) (clone $paymentsToday)->where('direction', 'out')->sum('amount');

        $purchaseTotal = (float) Transaction::query()
            ->whereDate('timestamp', $targetDate)
            ->whereIn(DB::raw('UPPER(tipe)'), ['BELI', 'BUY', 'PURCHASE'])
            ->sum('total');
        $salesTotal = (float) Transaction::query()
            ->whereDate('timestamp', $targetDate)
            ->whereIn(DB::raw('UPPER(tipe)'), ['JUAL', 'SELL', 'SALE'])
            ->sum('total');

        $stockRows = ErpCurrencyStock::query()->where('status', 'active')->get();
        $currencies = Currency::query()->get()->keyBy(fn ($currency) => strtoupper((string) $currency->code));
        $stockValuation = 0.0;
        foreach ($stockRows as $stock) {
            $master = $currencies->get(strtoupper((string) $stock->currency_code));
            $stockValuation += (float) $stock->quantity * (float) ($master?->buy ?? 0);
        }

        return [
            'date' => $targetDate,
            'cash' => $cash,
            'bank' => $bank,
            'bank_bca' => $bca,
            'bank_mandiri' => $mandiri,
            'total_liquid_idr' => $cash + $bank,
            'payment_in_today' => $paymentIn,
            'payment_out_today' => $paymentOut,
            'purchase_total_today' => $purchaseTotal,
            'sales_total_today' => $salesTotal,
            'stock_valuation_idr' => $stockValuation,
            'stock' => $stockRows->map(fn ($stock) => [
                'currency_code' => strtoupper((string) $stock->currency_code),
                'quantity' => (float) $stock->quantity,
            ])->values()->all(),
            'settlements' => [
                'pending' => (int) ErpSettlement::query()->where('status', 'pending')->count(),
                'settled' => (int) ErpSettlement::query()->where('status', 'settled')->count(),
            ],
            'total_customer' => (int) DB::table('mc_customers')->count(),
            'total_transaction_today' => (int) Transaction::query()->whereDate('timestamp', $targetDate)->count(),
        ];
    }

    private function accountBalance($accounts): float
    {
        return (float) $accounts->sum(function ($account) {
            $in = (float) $account->movements()->where('direction', 'in')->sum('amount');
            $out = (float) $account->movements()->where('direction', 'out')->sum('amount');
            return (float) $account->opening_balance + $in - $out;
        });
    }
}
