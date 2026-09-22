<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('erp_gantungan', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 40)->unique();
            $table->date('tanggal');
            $table->string('penerima', 120);
            $table->string('jenis', 60)->nullable();
            $table->decimal('jumlah_rp', 20, 2);
            $table->text('keterangan')->nullable();
            $table->string('status', 20)->default('OUTSTANDING')->index();
            $table->timestamp('returned_at')->nullable();
            $table->unsignedBigInteger('returned_by')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->index(['tanggal', 'status']);
        });

        Schema::create('erp_cash_closings', function (Blueprint $table) {
            $table->id();
            $table->string('closing_no', 40)->unique();
            $table->date('tanggal')->index();
            $table->decimal('opening_cash', 20, 2)->default(0);
            $table->decimal('cash_in', 20, 2)->default(0);
            $table->decimal('cash_out', 20, 2)->default(0);
            $table->decimal('expense', 20, 2)->default(0);
            $table->decimal('expected_cash', 20, 2)->default(0);
            $table->decimal('physical_cash', 20, 2)->default(0);
            $table->decimal('hanging_amount', 20, 2)->default(0);
            $table->decimal('accounted_cash', 20, 2)->default(0);
            $table->decimal('difference', 20, 2)->default(0);
            $table->string('status', 20)->default('DRAFT')->index();
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('closed_by')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('erp_cash_closings');
        Schema::dropIfExists('erp_gantungan');
    }
};
