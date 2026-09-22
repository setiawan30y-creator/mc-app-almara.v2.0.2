<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Closing Rp & Gantungan - MC Almara</title>
    <style>
        body{font-family:Inter,system-ui,sans-serif;background:#f4f6f8;color:#17202a;margin:0}.wrap{max-width:1200px;margin:30px auto;padding:0 18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.card{background:#fff;border:1px solid #e4e8ed;border-radius:12px;padding:18px;box-shadow:0 2px 8px #00000008}.wide{grid-column:1/-1}.value{font-size:24px;font-weight:750;margin-top:8px}.muted{color:#68727d;font-size:13px}.ok{color:#15803d}.warn{color:#b45309}.bad{color:#b91c1c}input,select,textarea,button{font:inherit;padding:10px;border:1px solid #d7dce1;border-radius:8px}button{cursor:pointer;background:#17202a;color:white}.row{display:flex;gap:10px;flex-wrap:wrap;align-items:end}label{display:grid;gap:5px;font-size:13px}.table{width:100%;border-collapse:collapse}.table th,.table td{padding:10px;border-bottom:1px solid #edf0f2;text-align:left}.flash{padding:12px;border-radius:8px;margin-bottom:14px;background:#eef7ee}.flash.warn{background:#fff7e8}.section{margin-top:18px}form.inline{display:inline}.status{font-weight:700}.header{display:flex;justify-content:space-between;gap:20px;align-items:center}.header a{color:#17202a}
        @media(max-width:800px){.grid{grid-template-columns:1fr 1fr}.wide{grid-column:1/-1}}@media(max-width:520px){.grid{grid-template-columns:1fr}}
    </style>
</head>
<body>
<div class="wrap">
    <div class="header"><div><h1>Closing Rp</h1><div class="muted">Reconciliation kas fisik + Gantungan Outstanding</div></div><a href="/">← Dashboard</a></div>

    @if(session('success'))<div class="flash">{{ session('success') }}</div>@endif
    @if(session('warning'))<div class="flash warn">{{ session('warning') }}</div>@endif
    @if($errors->any())<div class="flash warn">{{ $errors->first() }}</div>@endif

    <div class="section row">
        <form method="GET" action="/erp/closing" class="row">
            <label>Tanggal<input type="date" name="date" value="{{ $date }}"></label>
            <button type="submit">Hitung</button>
        </form>
    </div>

    <div class="grid section">
        <div class="card"><div class="muted">Opening Cash</div><div class="value">Rp {{ number_format($summary['opening_cash'],0,',','.') }}</div></div>
        <div class="card"><div class="muted">Cash In</div><div class="value">Rp {{ number_format($summary['cash_in'],0,',','.') }}</div></div>
        <div class="card"><div class="muted">Cash Out</div><div class="value">Rp {{ number_format($summary['cash_out'],0,',','.') }}</div></div>
        <div class="card"><div class="muted">Expected Cash</div><div class="value">Rp {{ number_format($summary['expected_cash'],0,',','.') }}</div></div>
    </div>

    <div class="grid section">
        <div class="card"><div class="muted">Outstanding Gantungan</div><div class="value">Rp {{ number_format($summary['hanging_amount'],0,',','.') }}</div></div>
        <div class="card wide">
            <form method="POST" action="/erp/closing" class="row">
                @csrf
                <input type="hidden" name="closing_date" value="{{ $date }}">
                <label>Physical Cash<input required min="0" step="0.01" type="number" name="physical_cash" placeholder="0"></label>
                <label>Catatan<textarea name="notes" rows="1" placeholder="Catatan closing"></textarea></label>
                <button type="submit">Reconcile & Closing</button>
            </form>
            <div class="muted" style="margin-top:10px">Accounted Cash = Physical Cash + Outstanding Gantungan. Closing hanya difinalisasi otomatis bila selisih = Rp0.</div>
        </div>
    </div>

    <div class="card section wide">
        <h2>Gantungan Outstanding</h2>
        <form method="POST" action="/erp/gantungan" class="row">
            @csrf
            <label>Tanggal/Jam<input required type="datetime-local" name="occurred_at" value="{{ now()->format('Y-m-d\\TH:i') }}"></label>
            <label>Penerima<input required name="recipient" placeholder="Nama penerima"></label>
            <label>Jenis<select name="type"><option value="OUTSIDE_CASH">OUTSIDE CASH</option><option value="BORROWED">DIPINJAM</option><option value="DEPOSIT">DITITIPKAN</option><option value="TEMP_USE">PENGGUNAAN SEMENTARA</option></select></label>
            <label>Nominal Rp<input required min="0.01" step="0.01" type="number" name="amount_rp"></label>
            <label>Keterangan<input name="description" placeholder="Keterangan"></label>
            <button type="submit">Tambah Gantungan</button>
        </form>
        <table class="table section"><thead><tr><th>Ref</th><th>Penerima</th><th>Jenis</th><th>Nominal</th><th>Waktu</th><th>Status</th><th></th></tr></thead><tbody>
        @forelse($gantungan as $item)
            <tr><td>{{ $item->reference_no }}</td><td>{{ $item->recipient }}</td><td>{{ $item->type }}</td><td>Rp {{ number_format($item->amount_rp,0,',','.') }}</td><td>{{ $item->occurred_at }}</td><td class="status">{{ $item->status }}</td><td><form class="inline" method="POST" action="/erp/gantungan/{{ $item->id }}/return">@csrf<button type="submit">Kembalikan</button></form></td></tr>
        @empty<tr><td colspan="7" class="muted">Tidak ada Gantungan Outstanding.</td></tr>@endforelse
        </tbody></table>
    </div>

    <div class="card section wide"><h2>Riwayat Closing</h2><table class="table"><thead><tr><th>No</th><th>Tanggal</th><th>Expected</th><th>Physical</th><th>Gantungan</th><th>Selisih</th><th>Status</th></tr></thead><tbody>
    @forelse($closings as $c)<tr><td>{{ $c->closing_no }}</td><td>{{ $c->closing_date?->format('Y-m-d') }}</td><td>Rp {{ number_format($c->expected_cash,0,',','.') }}</td><td>Rp {{ number_format($c->physical_cash,0,',','.') }}</td><td>Rp {{ number_format($c->hanging_amount,0,',','.') }}</td><td>Rp {{ number_format($c->difference,0,',','.') }}</td><td class="status">{{ $c->status }}</td></tr>@empty<tr><td colspan="7" class="muted">Belum ada closing.</td></tr>@endforelse
    </tbody></table></div>
</div>
</body>
</html>
