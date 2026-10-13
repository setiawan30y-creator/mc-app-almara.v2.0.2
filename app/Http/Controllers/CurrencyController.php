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

    public function publicIndex()
    {
        $currencies = Currency::query()
            ->get(['code', 'label', 'buy', 'sell', 'raw_json'])
            ->map(function ($currency) {
                $raw = [];

                if (is_string($currency->raw_json)) {
                    $decoded = json_decode($currency->raw_json, true);

                    if (is_array($decoded)) {
                        $raw = $decoded;
                    }
                }

                return [
                    'code' => $currency->code,
                    'label' => $currency->label,
                    'buy' => $currency->buy,
                    'sell' => $currency->sell,
                    'trend' => $raw['trend'] ?? 'flat',
                ];
            });

        return response()->json($currencies);
    }

public function store(Request $request)
{
    $validated = $request->validate([
        'code' => ['required', 'string', 'max:10'],
        'label' => ['sometimes', 'nullable', 'string', 'max:100'],
        'buy' => ['sometimes', 'nullable', 'numeric'],
        'sell' => ['sometimes', 'nullable', 'numeric'],
        'stock' => ['sometimes', 'nullable', 'numeric'],
    ]);

    $rawCode = trim((string) $validated['code']);

    if (preg_match('/^([a-zA-Z]{3})(?:\s*\(([^()]*)\))?$/', $rawCode, $parts)) {
        $baseCode = strtoupper($parts[1]);
        $variantLabel = isset($parts[2]) ? trim($parts[2]) : '';
        $code = $variantLabel !== ''
            ? $baseCode . ' (' . $variantLabel . ')'
            : $baseCode;
    } else {
        $code = strtoupper($rawCode);
    }

    try {
        $currency = Currency::find($code);

        $oldRaw = [];
        if ($currency && is_string($currency->raw_json)) {
            $decoded = json_decode($currency->raw_json, true);
            if (is_array($decoded)) {
                $oldRaw = $decoded;
            }
        }

        $input = $request->except(['raw_json', '_token', '_method']);
        $rawData = array_merge($oldRaw, $input, ['code' => $code]);

        $values = [
            'code' => $code,
            'label' => array_key_exists('label', $validated)
                && $validated['label'] !== null
                    ? $validated['label']
                    : ($currency->label ?? ''),
            'buy' => array_key_exists('buy', $validated)
                && $validated['buy'] !== null
                    ? (float) $validated['buy']
                    : (float) ($currency->buy ?? 0),
            'sell' => array_key_exists('sell', $validated)
                && $validated['sell'] !== null
                    ? (float) $validated['sell']
                    : (float) ($currency->sell ?? 0),
            'stock' => array_key_exists('stock', $validated)
                && $validated['stock'] !== null
                    ? (float) $validated['stock']
                    : (float) ($currency->stock ?? 0),
            'raw_json' => json_encode(
                $rawData,
                JSON_UNESCAPED_UNICODE
                    | JSON_UNESCAPED_SLASHES
                    | JSON_THROW_ON_ERROR
            ),
        ];

        if ($currency) {
            $currency->fill($values);
            $currency->save();
        } else {
            $currency = Currency::create($values);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Currency saved successfully (Laravel).',
            'data' => $currency->fresh(),
        ]);
    } catch (\Throwable $e) {
        report($e);

        return response()->json([
            'status' => 'error',
            'message' => 'Gagal menyimpan valuta ke database.',
        ], 500);
    }
}

    public function destroy(Request $request)
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
        ]);

        $rawCode = trim((string) $validated['code']);

if (preg_match('/^([a-zA-Z]{3})(?:\s*\(([^()]*)\))?$/', $rawCode, $parts)) {
    $baseCode = strtoupper($parts[1]);
    $variantLabel = isset($parts[2]) ? trim($parts[2]) : '';
    $code = $variantLabel !== ''
        ? $baseCode . ' (' . $variantLabel . ')'
        : $baseCode;
} else {
    $code = strtoupper($rawCode);
}

        try {
            $deleted = Currency::where('code', $code)->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted > 0
                    ? 'Currency deleted (Laravel)'
                    : 'Currency tidak ditemukan atau sudah terhapus',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
