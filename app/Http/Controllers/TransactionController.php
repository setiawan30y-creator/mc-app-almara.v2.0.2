<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\TransactionAudit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TransactionController extends Controller
{
    /**
     * Resolve the authenticated tenant/branch context.
     * Transactions must never be read or written without a valid SaaS context.
     */
    private function tenantContext(Request $request): array
    {
        $user = $request->user();

        if (!$user || !$user->tenant_id || !$user->branch_id) {
            abort(403, 'Akun belum memiliki tenant dan branch aktif.');
        }

        $tenant = $request->attributes->get('tenant');
        if ($tenant && (string) $tenant->id !== (string) $user->tenant_id) {
            abort(403, 'Tenant akun tidak sesuai dengan tenant request.');
        }

        if (!$user->tenant()->where('status', 'active')->exists()) {
            abort(403, 'Tenant akun tidak aktif.');
        }

        if (!$user->tenant->branches()
            ->whereKey($user->branch_id)
            ->where('status', 'active')
            ->exists()) {
            abort(403, 'Branch akun tidak aktif atau bukan bagian dari tenant.');
        }

        return [
            'tenant_id' => (string) $user->tenant_id,
            'branch_id' => (string) $user->branch_id,
        ];
    }

    public function index(Request $request)
    {
        $context = $this->tenantContext($request);

        $transactions = Transaction::query()
            ->forTenant($context['tenant_id'])
            ->forBranch($context['branch_id'])
            ->orderBy('timestamp', 'desc')
            ->orderBy('itemId', 'desc')
            ->get();

        return response()->json($transactions);
    }

    public function store(Request $request)
    {
        $context = $this->tenantContext($request);

        $validated = $request->validate([
            'id' => ['nullable', 'string', 'max:50', 'required_without:itemId'],
            'itemId' => ['nullable', 'string', 'max:100'],
            'timestamp' => ['required', 'date'],
            'tipe' => ['required', 'string', 'max:20'],
            'valuta' => ['required', 'string', 'max:10'],
            'nominal' => ['nullable', 'numeric'],
            'rate' => ['nullable', 'numeric'],
            'total' => ['nullable', 'numeric'],
            'customerId' => ['nullable', 'string', 'max:50'],
            'id_cif' => ['nullable', 'string', 'max:50'],
            'customerName' => ['nullable', 'string', 'max:255'],
            'kasir' => ['nullable', 'string', 'max:100'],
            'paymentMethod' => ['nullable', 'string', 'max:50'],
            'isOldMoney' => ['nullable', 'boolean'],
            'keterangan' => ['nullable', 'string'],
        ]);

        $input = $request->all();
        $invoiceId = $validated['id'] ?? $validated['itemId'];
        $itemId = $validated['itemId'] ?? ($invoiceId.'-'.Str::lower(Str::random(6)));

        $data = [
            'id' => $invoiceId,
            'tenant_id' => $context['tenant_id'],
            'branch_id' => $context['branch_id'],
            'timestamp' => Carbon::parse($validated['timestamp'])->format('Y-m-d H:i:s'),
            'tipe' => $validated['tipe'],
            'valuta' => $validated['valuta'],
            'nominal' => (float) ($validated['nominal'] ?? 0),
            'rate' => (float) ($validated['rate'] ?? 0),
            'total' => (float) ($validated['total'] ?? 0),
            'id_cif' => $validated['customerId'] ?? $validated['id_cif'] ?? '',
            'customerName' => $validated['customerName'] ?? '',
            'kasir' => $validated['kasir'] ?? '',
            'paymentMethod' => $validated['paymentMethod'] ?? 'TUNAI',
            'isOldMoney' => (bool) ($validated['isOldMoney'] ?? false),
            'keterangan' => $validated['keterangan'] ?? '',
            'raw_json' => json_encode($input),
        ];

        try {
            Transaction::updateOrCreate(
                ['itemId' => $itemId, 'tenant_id' => $context['tenant_id'], 'branch_id' => $context['branch_id']],
                $data
            );

            if (!TransactionAudit::where('itemId', $itemId)
                ->where('tenant_id', $context['tenant_id'])
                ->where('branch_id', $context['branch_id'])
                ->exists()) {
                TransactionAudit::updateOrCreate(
                    ['itemId' => $itemId],
                    $data
                );
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Transaksi Disimpan ke Database (Laravel)',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function bulkStore(Request $request)
    {
        $context = $this->tenantContext($request);
        $transactions = $request->input('transactions', []);

        if (!is_array($transactions)) {
            return response()->json(['status' => 'error', 'message' => 'Format data tidak valid'], 400);
        }

        $successCount = 0;
        $failedCount = 0;
        $errors = [];
        $invoiceIdsToClear = [];

        foreach ($transactions as $trx) {
            $invoiceId = $trx['id'] ?? $trx['itemId'] ?? null;
            if ($invoiceId) {
                $invoiceIdsToClear[$invoiceId] = true;
            }
        }

        $existingAudits = [];
        foreach (array_keys($invoiceIdsToClear) as $invoiceId) {
            if (TransactionAudit::where('id', $invoiceId)
                ->where('tenant_id', $context['tenant_id'])
                ->where('branch_id', $context['branch_id'])
                ->exists()) {
                $existingAudits[$invoiceId] = true;
            }
        }

        DB::beginTransaction();
        try {
            foreach (array_keys($invoiceIdsToClear) as $invoiceId) {
                Transaction::where('id', $invoiceId)
                    ->where('tenant_id', $context['tenant_id'])
                    ->where('branch_id', $context['branch_id'])
                    ->delete();
            }

            foreach ($transactions as $index => $input) {
                $invoiceId = $input['id'] ?? $input['itemId'] ?? null;
                $itemId = $input['itemId'] ?? ($invoiceId . '-' . Str::lower(Str::random(6)));

                $data = [
                    'id' => $invoiceId,
                    'tenant_id' => $context['tenant_id'],
                    'branch_id' => $context['branch_id'],
                    'timestamp' => Carbon::parse($input['timestamp'] ?? now())->format('Y-m-d H:i:s'),
                    'tipe' => $input['tipe'] ?? 'JUAL',
                    'valuta' => $input['valuta'] ?? '',
                    'nominal' => (float) ($input['nominal'] ?? 0),
                    'rate' => (float) ($input['rate'] ?? 0),
                    'total' => (float) ($input['total'] ?? 0),
                    'id_cif' => $input['customerId'] ?? $input['id_cif'] ?? '',
                    'customerName' => $input['customerName'] ?? '',
                    'kasir' => $input['kasir'] ?? '',
                    'paymentMethod' => $input['paymentMethod'] ?? 'TUNAI',
                    'isOldMoney' => (bool) ($input['isOldMoney'] ?? false),
                    'keterangan' => $input['keterangan'] ?? '',
                    'raw_json' => json_encode($input),
                ];

                try {
                    Transaction::updateOrCreate(
                        ['itemId' => $itemId, 'tenant_id' => $context['tenant_id'], 'branch_id' => $context['branch_id']],
                        $data
                    );

                    if (!isset($existingAudits[$invoiceId])) {
                        TransactionAudit::updateOrCreate(
                            ['itemId' => $itemId],
                            $data
                        );
                    }

                    $successCount++;
                } catch (\Exception $e) {
                    $failedCount++;
                    $errors[] = "Baris " . ($index + 1) . " (Item ID: $itemId): " . $e->getMessage();
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal memproses transaksi database: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'status' => 'success',
            'message' => "Proses import transaksi selesai. Sukses: {$successCount}, Gagal: {$failedCount}",
            'success_count' => $successCount,
            'failed_count' => $failedCount,
            'errors' => $errors,
        ]);
    }

    public function destroy(Request $request)
    {
        $context = $this->tenantContext($request);
        $itemId = $request->input('itemId');
        $id = $request->input('id');

        if (!$itemId && !$id) {
            return response()->json(['status' => 'error', 'message' => 'Missing ID'], 400);
        }

        try {
            $query = Transaction::query()
                ->where('tenant_id', $context['tenant_id'])
                ->where('branch_id', $context['branch_id']);

            if ($itemId) {
                $query->where('itemId', $itemId);
            } else {
                $query->where('id', $id);
            }

            $deleted = $query->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted > 0
                    ? 'Transaksi Dibatalkan/Dihapus (Laravel)'
                    : 'Tidak ada transaksi yang cocok untuk dihapus',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function audit(Request $request)
    {
        $context = $this->tenantContext($request);

        $audit = TransactionAudit::query()
            ->forTenant($context['tenant_id'])
            ->forBranch($context['branch_id'])
            ->orderBy('timestamp', 'desc')
            ->orderBy('itemId', 'desc')
            ->get();

        return response()->json($audit);
    }

    public function destroyAudit(Request $request)
    {
        $context = $this->tenantContext($request);
        $itemId = trim((string) $request->input('itemId', ''));

        if ($itemId === '') {
            return response()->json(['status' => 'error', 'message' => 'ID RWT tidak ditemukan'], 422);
        }

        try {
            $deleted = TransactionAudit::where('itemId', $itemId)
                ->where('tenant_id', $context['tenant_id'])
                ->where('branch_id', $context['branch_id'])
                ->delete();

            return response()->json([
                'status' => 'success',
                'message' => $deleted ? 'Baris RWT berhasil dihapus' : 'Data RWT sudah tidak ditemukan',
                'deleted_count' => $deleted,
            ]);
        } catch (\Exception $e) {
            return response()->json(['status' => 'error', 'message' => 'Gagal menghapus RWT: ' . $e->getMessage()], 500);
        }
    }

    public function clearAll(Request $request)
    {
        $context = $this->tenantContext($request);

        try {
            Transaction::query()
                ->where('tenant_id', $context['tenant_id'])
                ->where('branch_id', $context['branch_id'])
                ->delete();

            return response()->json([
                'status' => 'success',
                'message' => 'Semua riwayat transaksi tenant/branch ini telah dikosongkan. Audit transaksi tetap tersimpan.',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Gagal membersihkan transaksi: ' . $e->getMessage(),
            ], 500);
        }
    }
}
