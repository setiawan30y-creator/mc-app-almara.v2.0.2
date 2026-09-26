<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mc_transactions', function (Blueprint $table) {
            $table->char('tenant_id', 26)->nullable()->after('itemId');
            $table->char('branch_id', 26)->nullable()->after('tenant_id');

            $table->foreign('tenant_id', 'mc_transactions_tenant_fk')
                ->references('id')->on('tenants')
                ->nullOnDelete();

            $table->foreign('branch_id', 'mc_transactions_branch_fk')
                ->references('id')->on('branches')
                ->nullOnDelete();

            $table->index(['tenant_id', 'branch_id', 'timestamp'], 'mc_transactions_scope_time_idx');
            $table->index(['tenant_id', 'branch_id', 'itemId'], 'mc_transactions_scope_item_idx');
        });

        Schema::table('mc_transactions_audit', function (Blueprint $table) {
            $table->char('tenant_id', 26)->nullable()->after('itemId');
            $table->char('branch_id', 26)->nullable()->after('tenant_id');

            $table->foreign('tenant_id', 'mc_audit_tenant_fk')
                ->references('id')->on('tenants')
                ->nullOnDelete();

            $table->foreign('branch_id', 'mc_audit_branch_fk')
                ->references('id')->on('branches')
                ->nullOnDelete();

            $table->index(['tenant_id', 'branch_id', 'timestamp'], 'mc_audit_scope_time_idx');
            $table->index(['tenant_id', 'branch_id', 'itemId'], 'mc_audit_scope_item_idx');
        });
    }

    public function down(): void
    {
        Schema::table('mc_transactions_audit', function (Blueprint $table) {
            $table->dropForeign('mc_audit_tenant_fk');
            $table->dropForeign('mc_audit_branch_fk');
            $table->dropIndex('mc_audit_scope_time_idx');
            $table->dropIndex('mc_audit_scope_item_idx');
            $table->dropColumn(['tenant_id', 'branch_id']);
        });

        Schema::table('mc_transactions', function (Blueprint $table) {
            $table->dropForeign('mc_transactions_tenant_fk');
            $table->dropForeign('mc_transactions_branch_fk');
            $table->dropIndex('mc_transactions_scope_time_idx');
            $table->dropIndex('mc_transactions_scope_item_idx');
            $table->dropColumn(['tenant_id', 'branch_id']);
        });
    }
};
