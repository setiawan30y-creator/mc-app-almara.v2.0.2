<?php

namespace App\Http\Controllers;

use App\Models\ErpCashAccount;
use App\Models\ErpCashClosing;
use App\Models\ErpCashMovement;
use App\Models\ErpGantungan;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ErpCashClosingController extends Controller
{
    public function index(Request $request)
    {
        $date = $request->date ?: now()->toDateString();
        $account = ErpCashAccount::where('currency_code', 'IDR')->where('is_active', true)->orderBy('id')->first();
        $summary = $this->calculate($date, $account);
        $gantungan = ErpGantungan::where('status', 'OUTSTANDING')->orderBy('occurred_at')->get();
        $closings = ErpCashClosing::orderByDesc('closing_date')->limit(30)->get();

        return view('erp.cash-closing', compact('date', 'account', 'summary', 'gantungan', 'closings'));
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
            $account = ErpCashAccount::where('currency_code', 'IDR')->where('is_active', true)->orderBy('id')->lockForUpdate()->firstOrFail();
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

    private function calculate(string $date, ?ErpCashAccount $account): array
    {
        if (!$account) {
            return ['opening_cash' => 0, 'cash_in' => 0, 'cash_out' => 0, 'expense' => 0, 'expected_cash' => 0, 'hanging_amount' => (float) ErpGantungan::outstanding()->sum('amount_rp')];
        }

        $start = $date . ' 00:00:00';
        $end = $date . ' 23:59:59';
        $opening = (float) $account->opening_balance + (float) $account->movements()->where('posted_at', '<', $start)->sum(DB::raw("CASE WHEN direction = 'IN' THEN amount ELSE -amount END"));
        $in = (float) $account->movements()->whereBetween('posted_at', [$start, $end])->where('direction', 'IN')->sum('amount');
        $out = (float) $account->movements()->whereBetween('posted_at', [$start, $end])->where('direction', 'OUT')->sum('amount');
        $expense = (float) $account->movements()->whereBetween('posted_at', [$start, $end])->where('direction', 'OUT')->where('reference_type', 'expense')->sum('amount');
        $hanging = (float) ErpGantungan::outstanding()->sum('amount_rp');

        return [
            'opening_cash' => $opening,
            'cash_in' => $in,
            'cash_out' => $out,
            'expense' => $expense,
            'expected_cash' => $opening + $in - $out,
            'hanging_amount' => $hanging,
        ];
    }
}
