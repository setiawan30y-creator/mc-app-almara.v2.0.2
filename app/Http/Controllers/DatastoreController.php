<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
use App\Models\ErpBankAccount;
use App\Models\ErpCashAccount;
use App\Models\ErpPayment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DatastoreController extends Controller
{
    public function index()
    {
        $stores = Datastore::all();
        $data = [];
        foreach ($stores as $item) {
            $raw = $item->json_data;
            if (is_string($raw)) {
                $decoded = json_decode($raw, true);
                $data[$item->store_key] = json_last_error() === JSON_ERROR_NONE
                    ? $decoded
                    : $raw;
            } else {
                $data[$item->store_key] = $raw;
            }
        }

        // ERP is the source of truth for financial balances. These compatibility
        // keys are intentionally exposed through the existing datastore bridge so
        // the legacy dashboard can consume ERP balances without maintaining a
        // second cash/bank calculation in JavaScript.
        $data['mc_cash'] = $this->erpAccountBalance(
            ErpCashAccount::query()->where('currency_code', 'IDR')->where('is_active', true)->get()
        );

        $data['mc_bank_bca'] = $this->erpBankBalanceLike('BCA');
        $data['mc_bank_mandiri'] = $this->erpBankBalanceLike('MANDIRI');

        // ERP payment totals are provided for the next dashboard layer and for
        // reconciliation/debugging. They do not replace transaction history.
        $data['mc_erp_payment_totals'] = [
            'in' => (float) ErpPayment::query()->where('status', 'posted')->where('direction', 'in')->sum('amount'),
            'out' => (float) ErpPayment::query()->where('status', 'posted')->where('direction', 'out')->sum('amount'),
            'count' => (int) ErpPayment::query()->where('status', 'posted')->count(),
        ];

        return response()->json(['status' => 'success', 'data' => $data]);
    }

    private function erpAccountBalance($accounts): float
    {
        return (float) $accounts->sum(function ($account) {
            $in = (float) $account->movements()->where('direction', 'in')->sum('amount');
            $out = (float) $account->movements()->where('direction', 'out')->sum('amount');
            return (float) $account->opening_balance + $in - $out;
        });
    }

    private function erpBankBalanceLike(string $bankName): float
    {
        return $this->erpAccountBalance(
            ErpBankAccount::query()
                ->where('currency_code', 'IDR')
                ->where('is_active', true)
                ->where(function ($query) use ($bankName) {
                    $query->where('bank_name', 'like', '%'.$bankName.'%')
                        ->orWhere('code', 'like', '%'.$bankName.'%');
                })
                ->get()
        );
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'store_key' => ['required', 'string', 'max:100'],
            'json_data' => ['required'],
        ]);

        try {
            $jsonData = $validated['json_data'];
            if (is_string($jsonData)) {
                $decoded = json_decode($jsonData, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $jsonData = $decoded;
                }
            }

            Datastore::updateOrCreate(
                ['store_key' => $validated['store_key']],
                ['json_data' => $jsonData]
            );
            return response()->json([
                'status' => 'success',
                'message' => "Datastore {$validated['store_key']} tersimpan (Laravel)!"
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request)
    {
        $storeKey = $request->input('store_key');
        if (!$storeKey) {
            return response()->json(['status' => 'error', 'message' => 'store_key wajib diisi'], 400);
        }

        try {
            Datastore::where('store_key', $storeKey)->delete();
            return response()->json([
                'status' => 'success',
                'message' => "Datastore {$storeKey} dihapus"
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}
