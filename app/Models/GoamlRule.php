<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GoamlRule extends Model
{
    protected $table = 'goaml_rules';

    protected $fillable = [
        'name','code','rule_type','target','classification','severity','action',
        'min_transactions','period_days','total_amount_idr','amount_operator',
        'payment_method','conditions','is_active','priority','version',
    ];

    protected $casts = [
        'conditions' => 'array',
        'is_active' => 'boolean',
        'total_amount_idr' => 'decimal:2',
    ];

    public function alerts()
    {
        return $this->hasMany(GoamlAlert::class, 'rule_id');
    }
}