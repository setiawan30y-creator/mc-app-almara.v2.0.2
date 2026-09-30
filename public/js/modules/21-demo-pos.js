/* Demo POS: isolated from POS, currency master, and operational reports. */
(function () {
    const STOCK_KEY = 'mc_demo_pos_stock_v1';
    const TRX_KEY = 'mc_demo_pos_transactions_v1';
    const CART_KEY = 'mc_demo_pos_cart_v1';
    const safeGet = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
    const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
    const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value) || 0);
    const esc = (value) => String(value ?? '').replace(/[&<>'\"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;' }[char]));
    let type = 'BELI';
    let cart = safeGet(CART_KEY);
    let lastTransaction = null;
    let editingTransactionId = null;
    function stock() { return safeGet(STOCK_KEY); }
    function renderStock() { const rows = stock(); const body = document.getElementById('demoPosStockBody'); const select = document.getElementById('demoPosCurrency'); if (!body || !select) return; body.innerHTML = rows.length ? rows.map(item => `<tr><td><strong>${esc(item.code)}</strong></td><td>${Number(item.stock || 0).toLocaleString('id-ID')}</td><td>${rupiah(item.buy)}</td><td>${rupiah(item.sell)}</td><td><button class="btn btn-sm btn-danger" onclick="window.demoPosDeleteStock('${esc(item.id)}')" title="Hapus"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('') : '<tr><td colspan="5" class="text-center text-muted">Belum ada stok demo. Tambahkan stok untuk mulai latihan.</td></tr>'; const current = select.value; select.innerHTML = '<option value="">Pilih valas demo</option>' + rows.map(item => `<option value="${esc(item.id)}">${esc(item.code)} — stok ${Number(item.stock || 0).toLocaleString('id-ID')}</option>`).join(''); if (rows.some(item => item.id === current)) select.value = current; }
    function renderCart() { const buy = document.getElementById('demoPosBuyCart'); const sell = document.getElementById('demoPosSellCart'); const total = document.getElementById('demoPosTotal'); if (!buy || !sell || !total) return; const render = (side, empty) => { const lines = cart.filter(item => item.type === side); return lines.length ? lines.map((item, index) => `<div class="pos-cart-row"><strong>${esc(item.code)}</strong><span>${Number(item.amount).toLocaleString('id-ID')} × ${rupiah(item.rate)}</span><strong>${rupiah(item.total)}</strong><button class="btn btn-sm btn-danger" onclick="window.demoPosRemoveCart(${index})"><i class="fa-solid fa-xmark"></i></button></div>`).join('') : `<div class="pos-empty-cart">${empty}</div>`; }; buy.innerHTML = render('BELI', 'Belum ada pembelian demo'); sell.innerHTML = render('JUAL', 'Belum ada penjualan demo'); total.textContent = rupiah(cart.reduce((sum, item) => sum + Number(item.total || 0), 0)); }
    function renderHistory() { const host = document.getElementById('demoPosHistory'); if (!host) return; const items = safeGet(TRX_KEY).slice().reverse().slice(0, 30); host.innerHTML = items.length ? items.map(trx => `<tr><td>${esc(trx.date)}</td><td><strong>${esc(trx.invoice)}</strong><br><small class="text-muted">${esc(trx.payment)}</small></td><td>${esc(trx.customer || 'Tanpa data nasabah')}</td><td style="font-size:.82rem;">${trx.items.map(item => `${esc(item.type)} ${esc(item.code)} ${Number(item.amount).toLocaleString('id-ID')}`).join('<br>')}</td><td><strong style="color:#0f766e;">${rupiah(trx.total)}</strong></td><td style="white-space:nowrap;"><button class="btn btn-sm btn-secondary" onclick="window.demoPosPrint('${esc(trx.id)}')" title="Cetak rincian"><i class="fa-solid fa-print"></i></button> <button class="btn btn-sm btn-primary" onclick="window.demoPosEdit('${esc(trx.id)}')" title="Edit transaksi"></i></button></td></tr>`).join('') : '<tr><td colspan="6" class="text-center text-muted">Belum ada transaksi demo.</td></tr>'; }
    function newInvoice() { return 'DEMO-' + new Date().toISOString().slice(0,10).replaceAll('-', '') + '-' + String(Date.now()).slice(-5); }
    function resetForm() { editingTransactionId = null; cart = []; save(CART_KEY, cart); const today = new Date().toISOString().slice(0,10); const invoiceEl = document.getElementById('demoPosInvoice'); if (invoiceEl) invoiceEl.value = newInvoice(); const dateEl = document.getElementById('demoPosDate'); if (dateEl) dateEl.value = today; ['demoPosCustomer','demoPosRate','demoPosAmount','demoPosNote'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; }); const paymentEl = document.getElementById('demoPosPayment'); if (paymentEl) paymentEl.value = 'CASH'; const saveBtn = document.getElementById('demoPosSave'); if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-check-double"></i> Simpan Transaksi Demo'; renderCart(); renderStock(); }
    window.loadDemoPos = function () { if (!document.getElementById('demoPosInvoice')) return; if (!document.getElementById('demoPosInvoice').value) resetForm(); else { renderStock(); renderCart(); } renderHistory(); };
    window.demoPosSetType = function (next) { type = next; document.getElementById('demoPosBeli').classList.toggle('active', next === 'BELI'); document.getElementById('demoPosJual').classList.toggle('active', next === 'JUAL'); window.demoPosFillRate(); };
    window.demoPosFillRate = function () { const item = stock().find(row => row.id === document.getElementById('demoPosCurrency')?.value); const rate = document.getElementById('demoPosRate'); if (item && rate) rate.value = type === 'BELI' ? item.buy : item.sell; };
    window.demoPosAddCart = function () { const item = stock().find(row => row.id === document.getElementById('demoPosCurrency')?.value); const amount = Number(document.getElementById('demoPosAmount')?.value); const rate = Number(document.getElementById('demoPosRate')?.value); if (!item || amount <= 0 || rate <= 0) return alert('Pilih valas demo, lalu isi kurs dan jumlah yang valid.'); if (type === 'JUAL' && amount > Number(item.stock || 0)) return alert('Stok demo ' + item.code + ' tidak mencukupi.'); cart.push({ id: item.id, code: item.code, type, amount, rate, total: amount * rate }); save(CART_KEY, cart); document.getElementById('demoPosAmount').value = ''; renderCart(); };
    window.demoPosRemoveCart = function (index) { cart.splice(index, 1); save(CART_KEY, cart); renderCart(); };
    window.demoPosClearCart = function () { cart = []; save(CART_KEY, cart); renderCart(); };
    window.demoPosResetForm = resetForm;
    window.demoPosAddStock = function () { const code = prompt('Kode valas demo (contoh: USD):'); if (!code) return; const amount = Number(prompt('Jumlah stok demo:', '0')); const buy = Number(prompt('Kurs beli demo:', '0')); const sell = Number(prompt('Kurs jual demo:', '0')); if (!Number.isFinite(amount) || !Number.isFinite(buy) || !Number.isFinite(sell)) return alert('Angka stok dan kurs harus valid.'); const list = stock(); list.push({ id: 'demo_stock_' + Date.now(), code: code.trim().toUpperCase(), stock: amount, buy, sell }); save(STOCK_KEY, list); renderStock(); };
    window.demoPosDeleteStock = function (id) { if (!confirm('Hapus stok demo ini?')) return; save(STOCK_KEY, stock().filter(item => item.id !== id)); cart = cart.filter(item => item.id !== id); save(CART_KEY, cart); renderStock(); renderCart(); };
    window.demoPosProcess = function () { if (!cart.length) return alert('Keranjang demo masih kosong.'); const list = stock(); const history = safeGet(TRX_KEY); const oldIndex = editingTransactionId ? history.findIndex(item => item.id === editingTransactionId) : -1; const oldTransaction = oldIndex >= 0 ? history[oldIndex] : null; if (oldTransaction) oldTransaction.items.forEach(line => { const item = list.find(row => row.id === line.id); if (item) item.stock = Number(item.stock || 0) + (line.type === 'BELI' ? -line.amount : line.amount); }); for (const line of cart) { const item = list.find(row => row.id === line.id); if (!item || (line.type === 'JUAL' && Number(item.stock || 0) < line.amount)) return alert('Stok demo ' + line.code + ' tidak mencukupi.'); } cart.forEach(line => { const item = list.find(row => row.id === line.id); item.stock = Number(item.stock || 0) + (line.type === 'BELI' ? line.amount : -line.amount); }); const trx = { id: oldTransaction?.id || ('demo_trx_' + Date.now()), invoice: document.getElementById('demoPosInvoice').value || newInvoice(), date: document.getElementById('demoPosDate').value, customer: document.getElementById('demoPosCustomer').value.trim(), payment: document.getElementById('demoPosPayment').value, note: document.getElementById('demoPosNote').value.trim(), items: cart.map(item => ({ ...item })), total: cart.reduce((sum, item) => sum + item.total, 0), createdAt: oldTransaction?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }; if (oldIndex >= 0) history[oldIndex] = trx; else history.push(trx); save(STOCK_KEY, list); save(TRX_KEY, history); lastTransaction = trx; renderHistory(); document.getElementById('demoPosPrint').classList.remove('hidden'); alert(oldTransaction ? 'Transaksi demo berhasil diperbarui.' : 'Transaksi demo berhasil disimpan. Data POS utama tidak berubah.'); resetForm(); };
    window.demoPosEdit = function (id) { const trx = safeGet(TRX_KEY).find(item => item.id === id); if (!trx) return alert('Data transaksi demo tidak ditemukan.'); editingTransactionId = trx.id; cart = (trx.items || []).map(item => ({ ...item })); save(CART_KEY, cart); document.getElementById('demoPosInvoice').value = trx.invoice; document.getElementById('demoPosDate').value = trx.date; document.getElementById('demoPosCustomer').value = trx.customer || ''; document.getElementById('demoPosPayment').value = trx.payment || 'CASH'; document.getElementById('demoPosNote').value = trx.note || ''; const saveBtn = document.getElementById('demoPosSave'); if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan Demo'; renderStock(); renderCart(); document.getElementById('demo-pos-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    function printTransaction(trx) { if (!trx) return alert('Belum ada transaksi demo untuk dicetak.'); const popup = window.open('', '_blank', 'width=420,height=650'); if (!popup) return alert('Izinkan pop-up untuk mencetak rincian demo.'); popup.document.write(`<!doctype html><html><head><title>Rincian Demo</title><style>body{font:13px Arial;padding:18px;color:#111}h2{text-align:center;margin:0 0 12px}table{width:100%;border-collapse:collapse}td,th{padding:7px 0;border-bottom:1px dashed #999;text-align:left}td:last-child,th:last-child{text-align:right}.total{font-size:17px;font-weight:bold;margin-top:14px;text-align:right}</style></head><body><h2>RINCIAN TRANSAKSI DEMO</h2><div>No: ${esc(trx.invoice)}<br>Tanggal: ${esc(trx.date)}<br>Pembayaran: ${esc(trx.payment)}</div><table><thead><tr><th>Item</th><th>Qty × Kurs</th><th>Jumlah</th></tr></thead><tbody>${trx.items.map(i => `<tr><td>${esc(i.type)} ${esc(i.code)}</td><td>${Number(i.amount).toLocaleString('id-ID')} × ${rupiah(i.rate)}</td><td>${rupiah(i.total)}</td></tr>`).join('')}</tbody></table><div class="total">TOTAL ${rupiah(trx.total)}</div>${trx.note ? `<p>Catatan: ${esc(trx.note)}</p>` : ''}</body></html>`); popup.document.close(); popup.focus(); popup.print(); }
    window.demoPosPrint = function (id) { printTransaction(safeGet(TRX_KEY).find(item => item.id === id)); };
    window.demoPosPrintLast = function () { printTransaction(lastTransaction || safeGet(TRX_KEY).slice(-1)[0]); };
})();

// Install the startup firewall synchronously. sync.js registers its DOMContentLoaded
// synchronization callback before this module reaches the end of the deferred list.
// We must block those initial pulls here, not via a dynamically loaded guard that
// can race with DOMContentLoaded.
(function installStartupFirewall() {
    window.__almaraStartupPhase = true;
    const guardedNames = [
        'syncFromMySQL_Currencies',
        'syncFromMySQL_Transactions',
        'syncFromMySQL_Customers',
        'syncUniversalDatastore'
    ];
    guardedNames.forEach(function (name) {
        const original = window[name];
        if (typeof original !== 'function' || original.__almaraStartupGuarded) return;
        const wrapped = function () {
            if (window.__almaraStartupPhase) {
                console.info('[StartupFirewall] skipped:', name);
                return Promise.resolve({ skipped: true, reason: 'startup-firewall' });
            }
            return original.apply(this, arguments);
        };
        wrapped.__almaraStartupGuarded = true;
        wrapped.__almaraOriginal = original;
        window[name] = wrapped;
    });
    if (typeof window.stopAlmaraRealtimeSync === 'function') {
        window.stopAlmaraRealtimeSync();
    }
    window.setTimeout(function () {
        window.__almaraStartupPhase = false;
        console.info('[StartupFirewall] startup phase released.');
    }, 20000);
})();

// Keep the existing performance guard as a secondary/background safety net.
(function () {
    const script = document.createElement('script');
    script.src = '/js/modules/22-performance-guard.js?v=20260930-4';
    script.defer = false;
    document.head.appendChild(script);
})();

// Currency denomination editor/fallback were previously injected by routes/web.php.
// Keep routes/web.php simple and load these UI modules from the normal frontend chain.
(function loadCurrencyDenominationModules() {
    const modules = [
        '/js/modules/23-currency-denomination-editor.js?v=20260930-1',
        '/js/modules/24-currency-denomination-ui-fallback.js?v=20260930-1'
    ];
    modules.forEach(function (src) {
        if (document.querySelector('script[data-almara-denom-module="' + src + '"]')) return;
        const script = document.createElement('script');
        script.src = src;
        script.defer = false;
        script.dataset.almaraDenomModule = src;
        document.head.appendChild(script);
    });
})();
