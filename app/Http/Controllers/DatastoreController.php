<?php

namespace App\Http\Controllers;

use App\Models\Datastore;
use Illuminate\Http\Request;

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
        return response()->json(['status' => 'success', 'data' => $data]);
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
