<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ErpPayment extends Model
{
    protected $table = 'erp_payments';

    protected $fillable = [
        'payment_no', 'transaction_id', 'method', 'currency_code', 'amount',
        'cash_account_id', 'bank_account_id', 'reference', 'status', 'paid_at', 'created_by',
    ];

    protected $casts = [
        'amount' => 'decimal:8',
        'paid_at' => 'datetime',
    ];

    public function cashAccount(): BelongsTo
    {
        return $this->belongsTo(ErpCashAccount::class, 'cash_account_id');
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(ErpBankAccount::class, 'bank_account_id');
    }
}
