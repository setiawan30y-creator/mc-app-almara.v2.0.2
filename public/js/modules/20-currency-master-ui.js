(function () {
    'use strict';

    const STYLE_ID = 'almara-currency-master-ui-style';
    const DEFAULT_DENOMS = {
        USD: { banknote: [100, 50, 20, 10, 5, 1], coin: [1, 0.25, 0.10, 0.05] },
        EUR: { banknote: [500, 200, 100, 50, 20, 10, 5], coin: [2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01] },
        SGD: { banknote: [1000, 500, 100, 50, 20, 10, 5, 2], coin: [1, 0.50, 0.20, 0.10, 0.05] },
        AUD: { banknote: [100, 50, 20, 10, 5], coin: [2, 1, 0.50, 0.20, 0.10, 0.05] }
    };

    function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
    function num(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
    function fmtDenom(v) { const n = num(v); return Number.isInteger(n) ? n.toLocaleString('id-ID') : n.toLocaleString('id-ID', { maximumFractionDigits: 4 }); }

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #currencyModal .almara-currency-modal { width:min(1180px,96vw); max-height:92vh; overflow:auto; padding:0; border-radius:18px; }
            .almara-cm-head { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:20px 24px; border-bottom:1px solid rgba(148,163,184,.22); }
            .almara-cm-title { display:flex; align-items:center; gap:14px; }
            .almara-cm-title-icon { width:46px; height:46px; border-radius:13px; display:grid; place-items:center; background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#fff; font-size:22px; box-shadow:0 8px 20px rgba(245,158,11,.22); }
            .almara-cm-title h2 { margin:0; font-size:1.35rem; }
            .almara-cm-title p { margin:3px 0 0; color:#64748b; font-size:.86rem; }
            .almara-cm-body { display:grid; grid-template-columns:minmax(0,1fr) 320px; gap:18px; padding:20px 24px; }
            .almara-cm-card { background:rgba(248,250,252,.82); border:1px solid #e2e8f0; border-radius:14px; overflow:hidden; }
            .almara-cm-card-head { padding:14px 16px; font-weight:800; display:flex; align-items:center; gap:9px; border-bottom:1px solid #e2e8f0; }
            .almara-cm-card-head i { color:#2563eb; }
            .almara-cm-card-body { padding:16px; }
            .almara-cm-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
            .almara-cm-field label { display:block; font-weight:700; font-size:.82rem; margin-bottom:6px; color:#334155; }
            .almara-cm-field input, .almara-cm-field select { width:100%; box-sizing:border-box; border:1px solid #cbd5e1; border-radius:9px; padding:10px 11px; background:#fff; color:#0f172a; }
            .almara-cm-field small { display:block; margin-top:5px; color:#64748b; font-size:.73rem; }
            .almara-cm-switch { display:flex; align-items:center; gap:9px; height:40px; }
            .almara-cm-switch input { display:none; }
            .almara-cm-switch .track { width:40px; height:22px; border-radius:20px; background:#94a3b8; position:relative; cursor:pointer; }
            .almara-cm-switch .track:after { content:''; width:18px; height:18px; background:#fff; border-radius:50%; position:absolute; top:2px; left:2px; transition:.15s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
            .almara-cm-switch input:checked + .track { background:#10b981; }
            .almara-cm-switch input:checked + .track:after { left:20px; }
            .almara-cm-tabs { display:flex; gap:8px; padding:12px 16px 0; }
            .almara-cm-tab { border:1px solid #cbd5e1; background:#fff; border-radius:9px; padding:10px 14px; font-weight:700; cursor:pointer; flex:1; }
            .almara-cm-tab.active { background:#2563eb; color:#fff; border-color:#2563eb; }
            .almara-cm-denom-layout { display:grid; grid-template-columns:1fr 1fr; gap:14px; padding:14px 16px 16px; }
            .almara-cm-denom-panel { background:#fff; border:1px solid #e2e8f0; border-radius:11px; overflow:hidden; }
            .almara-cm-denom-head { padding:11px 13px; font-weight:800; background:#f8fafc; display:flex; justify-content:space-between; align-items:center; }
            .almara-cm-denom-table { width:100%; border-collapse:collapse; }
            .almara-cm-denom-table th,.almara-cm-denom-table td { padding:8px 10px; border-top:1px solid #eef2f7; text-align:left; font-size:.8rem; }
            .almara-cm-denom-table th { color:#64748b; font-size:.72rem; }
            .almara-cm-actions { display:flex; gap:5px; justify-content:flex-end; }
            .almara-cm-mini { border:0; border-radius:7px; width:30px; height:30px; cursor:pointer; color:#fff; }
            .almara-cm-mini.edit { background:#2563eb; } .almara-cm-mini.del { background:#ef4444; }
            .almara-cm-add { margin:10px 12px 13px; border:0; border-radius:8px; padding:9px 12px; background:#16a34a; color:#fff; font-weight:700; cursor:pointer; }
            .almara-cm-preview { position:sticky; top:0; align-self:start; }
            .almara-cm-preview-box { margin:16px; border:1px solid #e2e8f0; border-radius:12px; background:#fff; overflow:hidden; }
            .almara-cm-preview-top { padding:15px; background:linear-gradient(135deg,#eff6ff,#fff); display:flex; align-items:center; gap:12px; }
            .almara-cm-flag { width:54px; height:38px; border-radius:6px; background:#e2e8f0; display:grid; place-items:center; font-weight:900; color:#334155; }
            .almara-cm-preview-top strong { font-size:1.25rem; }
            .almara-cm-preview-top small { display:block; color:#64748b; margin-top:2px; }
            .almara-cm-preview-section { padding:12px 15px; border-top:1px solid #eef2f7; }
            .almara-cm-preview-section h4 { margin:0 0 7px; font-size:.8rem; }
            .almara-cm-preview-list { display:flex; flex-wrap:wrap; gap:6px; }
            .almara-cm-chip { border:1px solid #dbeafe; background:#eff6ff; color:#1d4ed8; border-radius:999px; padding:5px 9px; font-size:.74rem; font-weight:700; }
            .almara-cm-note { margin:0 16px 16px; padding:11px 12px; border-radius:10px; background:#ecfdf5; color:#166534; font-size:.76rem; }
            .almara-cm-footer { display:flex; justify-content:space-between; gap:10px; padding:14px 24px; border-top:1px solid #e2e8f0; }
            .almara-cm-footer button { min-width:120px; }
            .almara-cm-denom-empty { color:#94a3b8; text-align:center; padding:15px; font-size:.78rem; }
            .almara-cm-inline-add { display:flex; gap:7px; padding:0 12px 12px; }
            .almara-cm-inline-add input { flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:8px; }
            @media(max-width:900px){ .almara-cm-body{grid-template-columns:1fr}.almara-cm-preview{position:static}.almara-cm-denom-layout,.almara-cm-grid{grid-template-columns:1fr} }
        `;
        document.head.appendChild(style);
    }

    function ensureModal() {
        const modal = document.getElementById('currencyModal');
        if (!modal) return null;
        injectStyle();
        modal.innerHTML = `
            <div class="modal-content panel almara-currency-modal">
                <div class="almara-cm-head">
                    <div class="almara-cm-title"><div class="almara-cm-title-icon"><i class="fa-solid fa-coins"></i></div><div><h2>Edit/Tambah Valuta</h2><p>Kelola kode valuta, kurs, stok, dan denominasi pecahan uang.</p></div></div>
                    <button type="button" class="btn btn-outline" onclick="closeCurrencyModal()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="almara-cm-body">
                    <div>
                        <div class="almara-cm-card"><div class="almara-cm-card-head"><i class="fa-regular fa-file-lines"></i> Informasi Valuta</div><div class="almara-cm-card-body"><div class="almara-cm-grid">
                            <div class="almara-cm-field"><label>Kode Valuta *</label><input id="modalCurCode" list="masterCurList" oninput="handleCurrencyCodeInput()"><small>Contoh: USD, EUR, SGD</small></div>
                            <div class="almara-cm-field"><label>Nama Valuta *</label><input id="modalCurName" placeholder="US Dollar"></div>
                            <div class="almara-cm-field"><label>Kode Numeric (ISO 4217)</label><input id="modalCurNumeric" placeholder="840"></div>
                            <div class="almara-cm-field"><label>Simbol</label><input id="modalCurSymbol" placeholder="$"></div>
                            <div class="almara-cm-field"><label>Jumlah Desimal</label><input id="modalCurDecimals" type="number" min="0" max="6" value="2"><small>Angka di belakang koma</small></div>
                            <div class="almara-cm-field"><label>Status</label><label class="almara-cm-switch"><input id="modalCurActive" type="checkbox" checked><span class="track"></span><strong>Aktif</strong></label></div>
                        </div></div></div>
                        <div class="almara-cm-card" style="margin-top:16px"><div class="almara-cm-card-head"><i class="fa-solid fa-chart-line"></i> Kurs & Stok</div><div class="almara-cm-card-body"><div class="almara-cm-grid">
                            <div class="almara-cm-field"><label>Base Rate Beli</label><input type="number" id="modalCurBuy" oninput="calculateCurrencyHasil()"></div>
                            <div class="almara-cm-field"><label>Base Rate Jual</label><input type="number" id="modalCurSell" oninput="calculateCurrencyHasil()"></div>
                            <div class="almara-cm-field"><label>Stok Awal</label><input type="number" id="modalCurStock"></div>
                            <div class="almara-cm-field"><label>Batas Aman (Alert)</label><input type="number" id="modalCurAlert"></div>
                            <div class="almara-cm-field"><label>Selisih Beli</label><input type="number" id="modalMarginBuy" oninput="calculateCurrencyHasil()"><small>Hasil Beli: <b id="modalHasilBuy">0</b></small></div>
                            <div class="almara-cm-field"><label>Selisih Jual</label><input type="number" id="modalMarginSell" oninput="calculateCurrencyHasil()"><small>Hasil Jual: <b id="modalHasilSell">0</b></small></div>
                        </div></div></div>
                        <div class="almara-cm-card" style="margin-top:16px"><div class="almara-cm-card-head"><i class="fa-solid fa-coins"></i> Denominasi (Pecahan Uang)</div>
                            <div class="almara-cm-tabs"><button type="button" class="almara-cm-tab active" data-tab="banknote">Uang Kertas (Banknote)</button><button type="button" class="almara-cm-tab" data-tab="coin">Koin (Coin)</button></div>
                            <div class="almara-cm-denom-layout"><div class="almara-cm-denom-panel"><div class="almara-cm-denom-head"><span>Banknote</span><span id="cmBanknoteCount">0</span></div><div id="cmBanknoteTable"></div><button type="button" class="almara-cm-add" onclick="window.almaraAddDenom('banknote')"><i class="fa-solid fa-plus"></i> Tambah Denominasi</button></div>
                            <div class="almara-cm-denom-panel"><div class="almara-cm-denom-head"><span>Coin</span><span id="cmCoinCount">0</span></div><div id="cmCoinTable"></div><button type="button" class="almara-cm-add" onclick="window.almaraAddDenom('coin')"><i class="fa-solid fa-plus"></i> Tambah Denominasi</button></div></div>
                        </div>
                    </div>
                    <aside class="almara-cm-card almara-cm-preview"><div class="almara-cm-card-head"><i class="fa-solid fa-eye"></i> Preview Valuta</div><div class="almara-cm-preview-box"><div class="almara-cm-preview-top"><div class="almara-cm-flag" id="cmPreviewFlag">USD</div><div><strong id="cmPreviewCode">USD</strong><small id="cmPreviewName">US Dollar</small></div></div><div class="almara-cm-preview-section"><h4>Daftar Denominasi</h4><div class="almara-cm-preview-list" id="cmPreviewBanknotes"></div></div><div class="almara-cm-preview-section"><h4>Koin</h4><div class="almara-cm-preview-list" id="cmPreviewCoins"></div></div></div><p class="almara-cm-note"><i class="fa-solid fa-circle-info"></i> Denominasi yang disimpan menjadi referensi untuk Transaction, Stock Denominasi, dan Closing.</p></aside>
                </div>
                <div class="almara-cm-footer"><button type="button" class="btn btn-outline" onclick="closeCurrencyModal()"><i class="fa-solid fa-xmark"></i> Batal</button><button type="button" class="btn btn-primary" onclick="window.almaraSaveCurrencyMaster()"><i class="fa-solid fa-floppy-disk"></i> Simpan Valuta</button></div>
            </div>`;
        return modal;
    }

    function seedDenoms(code) { const key=String(code||'').trim().toUpperCase(); const seed=DEFAULT_DENOMS[key]||{banknote:[],coin:[]}; return {banknote:[...seed.banknote],coin:[...seed.coin]}; }
    function normalizeDenoms(c) { const d=c&&c.denominations; if(d&&typeof d==='object') return {banknote:Array.isArray(d.banknote)?d.banknote.map(num).filter(x=>x>0):[],coin:Array.isArray(d.coin)?d.coin.map(num).filter(x=>x>0):[]}; return seedDenoms(c&&c.code); }

    function renderDenoms() {
        const modal=document.getElementById('currencyModal'); if(!modal||!window.__almaraCurrencyDraft)return; const d=window.__almaraCurrencyDraft.denominations;
        const render=(type,id,countId)=>{const arr=d[type]||[],host=document.getElementById(id);document.getElementById(countId).textContent=arr.length;if(!arr.length){host.innerHTML='<div class="almara-cm-denom-empty">Belum ada denominasi.</div>';return;}host.innerHTML=`<table class="almara-cm-denom-table"><thead><tr><th>#</th><th>Denominasi</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${arr.map((v,i)=>`<tr><td>${i+1}</td><td><strong>${esc(fmtDenom(v))}</strong></td><td><span style="color:#16a34a;font-weight:700">Aktif</span></td><td><div class="almara-cm-actions"><button type="button" class="almara-cm-mini edit" onclick="window.almaraEditDenom('${type}',${i})"><i class="fa-solid fa-pen"></i></button><button type="button" class="almara-cm-mini del" onclick="window.almaraDeleteDenom('${type}',${i})"><i class="fa-solid fa-trash"></i></button></div></td></tr>`).join('')}</tbody></table>`;};
        render('banknote','cmBanknoteTable','cmBanknoteCount'); render('coin','cmCoinTable','cmCoinCount');
        const code=document.getElementById('modalCurCode')?.value||'USD', name=document.getElementById('modalCurName')?.value||'Nama Valuta'; document.getElementById('cmPreviewCode').textContent=code; document.getElementById('cmPreviewName').textContent=name; document.getElementById('cmPreviewFlag').textContent=code.slice(0,3).toUpperCase(); document.getElementById('cmPreviewBanknotes').innerHTML=d.banknote.map(v=>`<span class="almara-cm-chip">${esc(fmtDenom(v))}</span>`).join('')||'<span style="color:#94a3b8;font-size:.75rem">-</span>'; document.getElementById('cmPreviewCoins').innerHTML=d.coin.map(v=>`<span class="almara-cm-chip">${esc(fmtDenom(v))}</span>`).join('')||'<span style="color:#94a3b8;font-size:.75rem">-</span>';
    }

    function fill(c) {
        c=c||{}; const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v??'';}; set('modalCurCode',c.code||''); set('modalCurName',c.name||c.label||''); set('modalCurNumeric',c.numeric_code||''); set('modalCurSymbol',c.symbol||''); set('modalCurDecimals',c.decimals??2); set('modalCurBuy',c.base_buy??c.buy??''); set('modalCurSell',c.base_sell??c.sell??''); set('modalCurStock',c.stock??''); set('modalCurAlert',c.alert??''); set('modalMarginBuy',c.margin_buy??''); set('modalMarginSell',c.margin_sell??''); const active=document.getElementById('modalCurActive');if(active)active.checked=c.active!==false; window.__almaraCurrencyDraft={denominations:normalizeDenoms(c)}; renderDenoms(); ['modalCurCode','modalCurName'].forEach(id=>document.getElementById(id)?.addEventListener('input',renderDenoms)); if(typeof window.calculateCurrencyHasil==='function')window.calculateCurrencyHasil();
    }

    function open(code=null) { const modal=ensureModal();if(!modal)return;const currencies=typeof getCurrencies==='function'?getCurrencies():[];const c=code?currencies.find(x=>String(x.code||'').toUpperCase()===String(code).toUpperCase()):null;fill(c||{code:'',name:'',active:true,denominations:seedDenoms('')});const input=document.getElementById('modalCurCode');if(input)input.disabled=!!code;modal.classList.add('show'); }

    window.almaraAddDenom=function(type){const current=window.__almaraCurrencyDraft?.denominations?.[type]||[],host=document.getElementById(type==='banknote'?'cmBanknoteTable':'cmCoinTable');if(!host)return;if(host.querySelector('.almara-cm-inline-add'))return;const wrap=document.createElement('div');wrap.className='almara-cm-inline-add';wrap.innerHTML='<input type="number" step="any" min="0.000001" placeholder="Nilai denominasi"><button type="button" class="btn btn-primary">Tambah</button>';host.parentElement.insertBefore(wrap,host.nextSibling);wrap.querySelector('button').onclick=()=>{const v=num(wrap.querySelector('input').value);if(v<=0)return alert('Denominasi harus lebih besar dari 0.');if(!window.__almaraCurrencyDraft.denominations[type].includes(v)){window.__almaraCurrencyDraft.denominations[type].push(v);window.__almaraCurrencyDraft.denominations[type].sort((a,b)=>b-a);}wrap.remove();renderDenoms();};wrap.querySelector('input').focus();};
    window.almaraEditDenom=function(type,index){const arr=window.__almaraCurrencyDraft?.denominations?.[type]||[];if(arr[index]==null)return;const value=prompt('Ubah nilai denominasi:',arr[index]);if(value===null)return;const n=num(value);if(n<=0)return alert('Denominasi harus lebih besar dari 0.');if(arr.some((x,i)=>i!==index&&x===n))return alert('Denominasi tersebut sudah ada.');arr[index]=n;arr.sort((a,b)=>b-a);renderDenoms();};
    window.almaraDeleteDenom=function(type,index){const arr=window.__almaraCurrencyDraft?.denominations?.[type]||[];if(arr[index]==null)return;arr.splice(index,1);renderDenoms();};

    window.almaraSaveCurrencyMaster=function(){const code=String(document.getElementById('modalCurCode')?.value||'').trim().toUpperCase(),name=String(document.getElementById('modalCurName')?.value||'').trim(),baseBuy=num(document.getElementById('modalCurBuy')?.value),baseSell=num(document.getElementById('modalCurSell')?.value);if(!code||!name||baseBuy<=0||baseSell<=0)return alert('Kode, Nama Valuta, Base Rate Beli, dan Base Rate Jual wajib diisi.');const currencies=typeof getCurrencies==='function'?getCurrencies():[],index=currencies.findIndex(c=>String(c.code||'').toUpperCase()===code),old=index>=0?currencies[index]:{},mb=num(document.getElementById('modalMarginBuy')?.value),ms=num(document.getElementById('modalMarginSell')?.value),data={...old,code,name,label:name,numeric_code:String(document.getElementById('modalCurNumeric')?.value||'').trim(),symbol:String(document.getElementById('modalCurSymbol')?.value||'').trim(),decimals:Math.max(0,Math.min(6,num(document.getElementById('modalCurDecimals')?.value,2))),active:!!document.getElementById('modalCurActive')?.checked,base_buy:baseBuy,base_sell:baseSell,buy:baseBuy+mb,sell:baseSell+ms,stock:num(document.getElementById('modalCurStock')?.value),alert:num(document.getElementById('modalCurAlert')?.value,500),margin_buy:mb,margin_sell:ms,denominations:{banknote:[...(window.__almaraCurrencyDraft?.denominations?.banknote||[])],coin:[...(window.__almaraCurrencyDraft?.denominations?.coin||[])]},denomination_updated_at:new Date().toISOString()};const user=typeof getCurrentUser==='function'?getCurrentUser():null;if(index>=0){data.inputBy=old.inputBy||user?.fullName||'Admin Kasir';data.editBy=user?.fullName||'Admin Kasir';currencies[index]=data;}else{data.inputBy=user?.fullName||'Admin Kasir';data.editBy='';currencies.push(data);}if(typeof saveCurrencies!=='function')return alert('Penyimpanan valuta tidak tersedia.');saveCurrencies(currencies);if(typeof loadCurrencyTable==='function')loadCurrencyTable();if(typeof closeCurrencyModal==='function')closeCurrencyModal();alert(`Valuta ${code} berhasil disimpan beserta ${data.denominations.banknote.length} banknote dan ${data.denominations.coin.length} koin.`);};

    window.closeCurrencyModal=function(){const modal=document.getElementById('currencyModal');if(modal)modal.classList.remove('show');window.__almaraCurrencyDraft=null;};
    window.openCurrencyModal=open;
    window.almaraCurrencyMasterUI={open,renderDenoms};
})();
