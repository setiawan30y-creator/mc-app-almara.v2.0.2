<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    use HasFactory;

    protected $table = 'mc_transactions';
    protected $primaryKey = 'itemId';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'itemId', 'id', 'tenant_id', 'branch_id', 'timestamp', 'kasir', 'tipe', 'valuta',
        'nominal', 'rate', 'total', 'paymentMethod', 'customerName',
        'id_cif', 'isOldMoney', 'keterangan', 'raw_json'
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'isOldMoney' => 'boolean',
        'nominal' => 'double',
        'rate' => 'double',
        'total' => 'double',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function scopeForTenant($query, string $tenantId)
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeForBranch($query, string $branchId)
    {
        return $query->where('branch_id', $branchId);
    }
}
