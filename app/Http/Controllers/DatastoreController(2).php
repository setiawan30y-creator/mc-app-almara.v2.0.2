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
            $decoded = json_decode($item->json_data, true);
            $data[$item->store_key] = json_last_error() === JSON_ERROR_NONE
                ? $decoded
                : $item->json_data;
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
            Datastore::updateOrCreate(
                ['store_key' => $validated['store_key']],
                ['json_data' => $validated['json_data']]
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
