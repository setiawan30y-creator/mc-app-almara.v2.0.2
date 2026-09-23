<?php

namespace App\Http\Controllers;

use App\Models\ErpCashAccount;
use App\Models\ErpCashClosing;
use App\Models\ErpGantungan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ErpCashClosingController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->date ?: now()->toDateString();
        $account = $this->getOrCreateIdrCashAccount();
        $summary = $this->calculate($date, $account);
        $gantungan = ErpGantungan::where('status', 'OUTSTANDING')->orderBy('occurred_at')->get();
        $closings = ErpCashClosing::orderByDesc('closing_date')->limit(30)->get();

        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';
        $movements = $account->movements()
            ->whereBetween('posted_at', [$start, $end])
            ->orderBy('posted_at')
            ->orderBy('id')
            ->get();

        $latestClosing = ErpCashClosing::whereDate('closing_date', $date)
            ->orderByDesc('id')
            ->first();

        return view('erp.cash-closing', compact(
            'date', 'account', 'summary', 'gantungan', 'closings', 'movements', 'latestClosing'
        ));
    }

    public function gantungan(Request $request)
    {
        $items = ErpGantungan::orderByDesc('occurred_at')->limit(100)->get();
        $outstanding = (float) ErpGantungan::where('status', 'OUTSTANDING')->sum('amount_rp');
        $returned = (float) ErpGantungan::where('status', 'RETURNED')->sum('amount_rp');

        return view('erp.gantungan', compact('items', 'outstanding', 'returned'));
    }

    public function gantunganStore(Request $request)
    {
        $data = $request->validate([
            'occurred_at' => ['required', 'date'],
            'recipient' => ['required', 'string', 'max:150'],
            'type' => ['nullable', 'string', 'max:40'],
            'amount_rp' => ['required', 'numeric', 'min:0.01'],
            'description' => ['nullable', 'string'],
        ]);

        $data['reference_no'] = 'GNT-' . now()->format('YmdHis') . '-' . Str::upper(Str::random(4));
        $data['status'] = 'OUTSTANDING';
        $data['created_by'] = auth()->id();
        $data['updated_by'] = auth()->id();

        ErpGantungan::create($data);

        return back()->with('success', 'Gantungan berhasil dicatat sebagai OUTSTANDING.');
    }

    public function gantunganReturn(ErpGantungan $gantungan)
    {
        abort_unless($gantungan->status === 'OUTSTANDING', 422, 'Gantungan sudah dikembalikan.');

        $gantungan->update([
            'status' => 'RETURNED',
            'returned_at' => now(),
            'returned_by' => auth()->id(),
            'updated_by' => auth()->id(),
        ]);

        return back()->with('success', 'Gantungan ditandai RETURNED.');
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'closing_date' => ['required', 'date'],
            'physical_cash' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $date = $data['closing_date'];
            // A new ERP installation may have no active IDR cash account yet.
            // Provision the default account instead of returning Laravel's 404 from firstOrFail().
            $account = $this->getOrCreateIdrCashAccount(true);
            $summary = $this->calculate($date, $account);

            $closing = ErpCashClosing::firstOrNew(['closing_date' => $date]);
            if ($closing->exists && $closing->status === 'CLOSED') {
                abort(422, 'Closing tanggal tersebut sudah CLOSED.');
            }

            $physical = (float) $data['physical_cash'];
            $hanging = (float) $summary['hanging_amount'];
            $accounted = $physical + $hanging;
            $difference = $accounted - (float) $summary['expected_cash'];
            $status = abs($difference) < 0.005 ? 'BALANCED' : ($difference < 0 ? 'SHORT' : 'OVER');

            $closing->fill([
                'closing_no' => $closing->closing_no ?: 'CLS-' . date('Ymd', strtotime($date)) . '-' . Str::upper(Str::random(4)),
                'opening_cash' => $summary['opening_cash'],
                'cash_in' => $summary['cash_in'],
                'cash_out' => $summary['cash_out'],
                'expense' => $summary['expense'],
                'expected_cash' => $summary['expected_cash'],
                'physical_cash' => $physical,
                'hanging_amount' => $hanging,
                'accounted_cash' => $accounted,
                'difference' => $difference,
                'status' => $status,
                'notes' => $data['notes'] ?? null,
                'closed_by' => $status === 'BALANCED' ? auth()->id() : null,
                'closed_at' => $status === 'BALANCED' ? now() : null,
            ]);
            if ($status === 'BALANCED') {
                $closing->status = 'CLOSED';
            }
            $closing->created_by = $closing->created_by ?: auth()->id();
            $closing->updated_by = auth()->id();
            $closing->save();

            return back()->with($status === 'CLOSED' ? 'success' : 'warning', $status === 'CLOSED'
                ? 'Closing berhasil difinalisasi: BALANCED.'
                : "Closing disimpan sebagai $status dan belum difinalisasi.");
        }, 3);
    }

    private function getOrCreateIdrCashAccount(bool $lock = false): ErpCashAccount
    {
        $query = ErpCashAccount::where('currency_code', 'IDR')
            ->where('is_active', true)
            ->orderBy('id');

        $account = $lock ? $query->lockForUpdate()->first() : $query->first();

        if ($account) {
            return $account;
        }

        return ErpCashAccount::firstOrCreate(
            ['code' => 'CASH-IDR-01'],
            [
                'name' => 'Kas Utama IDR',
                'currency_code' => 'IDR',
                'opening_balance' => 0,
                'is_active' => true,
            ]
        );
    }

    private function calculate(string $date, ?ErpCashAccount $account): array
    {
        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';

        if (!$account) {
            return [
                'opening_cash' => 0,
                'cash_in' => 0,
                'cash_out' => 0,
                'expense' => 0,
                'expected_cash' => 0,
                'hanging_amount' => $this->hangingAt($end),
            ];
        }

        $opening = (float) $account->opening_balance
            + (float) $account->movements()
                ->where('posted_at', '<', $start)
                ->sum(DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));

        $in = (float) $account->movements()
            ->whereBetween('posted_at', [$start, $end])
            ->where('direction', 'IN')
            ->sum('amount');

        $out = (float) $account->movements()
            ->whereBetween('posted_at', [$start, $end])
            ->where('direction', 'OUT')
            ->sum('amount');

        $expense = (float) $account->movements()
            ->whereBetween('posted_at', [$start, $end])
            ->where('direction', 'OUT')
            ->where('reference_type', 'expense')
            ->sum('amount');

        $hanging = $this->hangingAt($end);

        return [
            'opening_cash' => $opening,
            'cash_in' => $in,
            'cash_out' => $out,
            'expense' => $expense,
            'expected_cash' => $opening + $in - $out,
            'hanging_amount' => $hanging,
        ];
    }

    private function hangingAt(string $cutoff): float
    {
        return (float) ErpGantungan::query()
            ->where('occurred_at', '<=', $cutoff)
            ->where(function ($query) use ($cutoff) {
                $query->whereNull('returned_at')
                    ->orWhere('returned_at', '>', $cutoff);
            })
            ->sum('amount_rp');
    }
}
