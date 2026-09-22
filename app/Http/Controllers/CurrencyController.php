<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use Illuminate\Http\Request;

class CurrencyController extends Controller
{
    public function index()
    {
        $currencies = Currency::all();
        return response()->json($currencies);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
            'label' => ['nullable', 'string', 'max:100'],
            'buy' => ['nullable', 'numeric'],
            'sell' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'numeric'],
        ]);
        $input = $request->all();

        try {
            Currency::updateOrCreate(
                ['code' => $validated['code']],
                [
                    'label' => $validated['label'] ?? '',
                    'buy' => (float) ($validated['buy'] ?? 0),
                    'sell' => (float) ($validated['sell'] ?? 0),
                    'stock' => (float) ($validated['stock'] ?? 0),
                    'raw_json' => json_encode($input)
                ]
            );
            return response()->json(['status' => 'success', 'message' => 'Currency updated (Laravel)']);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }

    public function destroy(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
        ]);

        try {
            $deleted = Currency::where('code', $validated['code'])->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted > 0
                    ? 'Currency deleted (Laravel)'
                    : 'Currency tidak ditemukan atau sudah terhapus',
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => $e->getMessage()], 500);
        }
    }
}
