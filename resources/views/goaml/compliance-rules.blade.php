<!doctype html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>GOAML Compliance Rules — MC Almara</title>
    <style>
        body{font-family:Inter,system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f4f6f8;color:#18212f}
        .wrap{max-width:1250px;margin:30px auto;padding:0 20px}.head{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
        h1{margin:0;font-size:25px}.sub{color:#697586;margin-top:5px}.card{background:#fff;border:1px solid #e3e7ed;border-radius:14px;padding:20px;margin-bottom:18px;box-shadow:0 3px 14px #00000008}
        .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.field{display:flex;flex-direction:column;gap:6px}.field label{font-size:12px;font-weight:700;color:#5b6575}.field input,.field select{height:38px;border:1px solid #ccd3dd;border-radius:8px;padding:0 10px}
        .wide{grid-column:span 2}.actions{display:flex;gap:8px;align-items:end}.btn{height:38px;border:0;border-radius:8px;padding:0 14px;font-weight:700;cursor:pointer}.primary{background:#1677ff;color:#fff}.muted{background:#eef1f5;color:#344054}
        table{width:100%;border-collapse:collapse;font-size:13px}th,td{padding:11px 9px;border-bottom:1px solid #edf0f3;text-align:left;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#667085;background:#fafbfc}
        .pill{display:inline-flex;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700}.green{background:#e8f7ed;color:#16733a}.orange{background:#fff3db;color:#9a5b00}.gray{background:#eef1f5;color:#667085}
        .alert{padding:12px;border-radius:9px;margin-bottom:12px}.ok{background:#eaf8ef;color:#176b37}.err{background:#fff0f0;color:#a32121}.note{font-size:12px;color:#667085}
        @media(max-width:900px){.grid{grid-template-columns:1fr 1fr}.wide{grid-column:span 2}} @media(max-width:600px){.grid{grid-template-columns:1fr}.wide{grid-column:span 1}}
    </style>
</head>
<body>
<div class="wrap">
    <div class="head">
        <div><h1>GOAML / Compliance Rules</h1><div class="sub">Rule Engine untuk monitoring transaksi dan review Compliance</div></div>
        <a href="/" class="btn muted" style="text-decoration:none;display:flex;align-items:center">← Dashboard</a>
    </div>

    <div id="msg"></div>

    <div class="card">
        <h3 style="margin-top:0">Tambah Rule Monitoring</h3>
        <div class="grid">
            <div class="field wide"><label>Nama Rule</label><input id="name" value="Monitoring 3 Transaksi / 7 Hari > Rp500 Juta"></div>
            <div class="field"><label>Kode</label><input id="code" value="IM-CUSTOMER-3TX-7D-500M"></div>
            <div class="field"><label>Jenis</label><select id="rule_type"><option value="INTERNAL_MONITORING">INTERNAL MONITORING</option><option value="REGULATORY">REGULATORY</option></select></div>
            <div class="field"><label>Target</label><select id="target"><option>CUSTOMER</option></select></div>
            <div class="field"><label>Minimal Transaksi</label><input id="min_transactions" type="number" value="3" min="1"></div>
            <div class="field"><label>Periode (hari)</label><input id="period_days" type="number" value="7" min="1"></div>
            <div class="field"><label>Total Nominal IDR</label><input id="total_amount_idr" type="number" value="500000000" min="0"></div>
            <div class="field"><label>Operator Nominal</label><select id="amount_operator"><option>></option><option>>=</option><option>=</option><option><</option><option><=</option></select></div>
            <div class="field"><label>Severity</label><select id="severity"><option>INFO</option><option selected>WARNING</option><option>REVIEW</option><option>BLOCK</option></select></div>
            <div class="field"><label>Action</label><select id="action"><option>ALERT</option><option selected>REVIEW</option><option>FLAG</option><option>REQUIRE_APPROVAL</option><option>BLOCK</option></select></div>
            <div class="field"><label>Priority</label><input id="priority" type="number" value="100" min="1"></div>
            <div class="field actions"><button class="btn primary" onclick="saveRule()">Simpan Rule</button></div>
        </div>
        <p class="note">Catatan: rule INTERNAL MONITORING bukan otomatis klasifikasi LTKM/LTKT/LTKL. Penetapan laporan dilakukan setelah review Compliance.</p>
    </div>

    <div class="card">
        <h3 style="margin-top:0">Rule Aktif</h3>
        <div id="rules">Memuat...</div>
    </div>

    <div class="card">
        <h3 style="margin-top:0">Alert Compliance Terbaru</h3>
        <div id="alerts">Memuat...</div>
    </div>
</div>
<script>
const api = (p,o={}) => fetch('/api'+p,{headers:{'Content-Type':'application/json'},...o}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'HTTP '+r.status);return j});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
function show(type,text){document.getElementById('msg').innerHTML='<div class="alert '+(type==='ok'?'ok':'err')+'">'+esc(text)+'</div>';setTimeout(()=>document.getElementById('msg').innerHTML='',3500)}
async function loadRules(){
 const j=await api('/goaml/rules'); const rows=j;
 document.getElementById('rules').innerHTML='<table><thead><tr><th>Rule</th><th>Jenis</th><th>Kriteria</th><th>Severity</th><th>Action</th><th>Status</th><th>Versi</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+esc(r.name)+'</b><br><span class="note">'+esc(r.code)+'</span></td><td>'+esc(r.rule_type)+'</td><td>'+esc(r.min_transactions)+' transaksi / '+esc(r.period_days)+' hari<br>total '+esc(r.amount_operator)+' Rp '+Number(r.total_amount_idr||0).toLocaleString('id-ID')+'</td><td>'+esc(r.severity)+'</td><td>'+esc(r.action)+'</td><td>'+(r.is_active?'<span class="pill green">AKTIF</span>':'<span class="pill gray">NONAKTIF</span>')+'</td><td>'+esc(r.version)+'</td></tr>').join('')+'</tbody></table>';
}
async function loadAlerts(){
 const j=await api('/goaml/alerts'); const rows=j;
 if(!rows.length){document.getElementById('alerts').innerHTML='<div class="note">Belum ada alert.</div>';return}
 document.getElementById('alerts').innerHTML='<table><thead><tr><th>Alert</th><th>Customer</th><th>Rule</th><th>Transaksi</th><th>Total</th><th>Status</th><th>Periode</th></tr></thead><tbody>'+rows.map(a=>'<tr><td><b>'+esc(a.alert_no)+'</b><br><span class="note">'+esc(a.severity)+'</span></td><td>'+esc(a.customer_name)+'<br><span class="note">'+esc(a.customer_id)+'</span></td><td>'+esc(a.rule?.name||'—')+'</td><td>'+esc(a.transaction_count)+'</td><td>Rp '+Number(a.total_amount_idr||0).toLocaleString('id-ID')+'</td><td><span class="pill orange">'+esc(a.status)+'</span></td><td>'+esc(a.period_start)+' — '+esc(a.period_end)+'</td></tr>').join('')+'</tbody></table>';
}
async function saveRule(){
 try{
  const body={name:name.value,code:code.value,rule_type:rule_type.value,target:target.value,classification:rule_type.value==='INTERNAL_MONITORING'?'INTERNAL_WARNING':null,severity:severity.value,action:action.value,min_transactions:Number(min_transactions.value||0)||null,period_days:Number(period_days.value||0)||null,total_amount_idr:Number(total_amount_idr.value||0)||null,amount_operator:amount_operator.value,priority:Number(priority.value||100),is_active:true};
  await api('/goaml/rules',{method:'POST',body:JSON.stringify(body)}); show('ok','Rule berhasil disimpan'); loadRules();
 }catch(e){show('err',e.message)}
}
loadRules();loadAlerts();setInterval(loadAlerts,15000);
</script>
</body>
</html>