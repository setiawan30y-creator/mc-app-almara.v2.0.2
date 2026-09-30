$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = Join-Path $root 'public\js\sync.js'
if (-not (Test-Path $file)) { throw "sync.js tidak ditemukan: $file" }

$content = Get-Content -Raw -Encoding UTF8 $file
$backup = "$file.before-notification-fix.js"
Copy-Item $file $backup -Force

$old = @'
function getTransactionNotifyUserKey() {
    let userKey = 'guest';
    try {
        const currentUser = JSON.parse(localStorage.getItem('mc_currentUser') || 'null');
        userKey = currentUser && (currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            ? String(currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            : 'guest';
    } catch (error) {
        userKey = 'guest';
    }
    return 'mc_seen_transaction_keys_v1_' + userKey.replace(/[^a-z0-9_-]/gi, '_');
}

function getSeenTransactionKeysForNotification() {
    try {
        const parsed = JSON.parse(localStorage.getItem(getTransactionNotifyUserKey()) || '[]');
        return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch (error) {
        return new Set();
    }
}

function saveSeenTransactionKeysForNotification(keys) {
    const list = Array.from(keys).filter(Boolean).slice(-2500);
    localStorage.setItem(getTransactionNotifyUserKey(), JSON.stringify(list));
}
'@

$new = @'
// Notifikasi transaksi adalah status per-browser, bukan per-user.
// Transaksi yang sudah di-Close tidak muncul lagi setelah refresh, logout/login,
// atau perpindahan halaman.
const TRANSACTION_NOTIFICATION_SEEN_KEY = 'mc_seen_transaction_notifications_v2';

function getTransactionNotifyUserKey() {
    // Alias kompatibilitas untuk kode lama.
    return TRANSACTION_NOTIFICATION_SEEN_KEY;
}

function getSeenTransactionKeysForNotification() {
    const keys = new Set();
    const addParsed = (raw) => {
        try {
            const parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) parsed.forEach(value => {
                const key = String(value || '').trim();
                if (key) keys.add(key);
            });
        } catch (error) {}
    };

    try {
        // Sumber status baru: satu storage dismissed per browser.
        addParsed(localStorage.getItem(TRANSACTION_NOTIFICATION_SEEN_KEY));

        // Migrasi status v1 milik akun yang sedang aktif tanpa menghapus data lama.
        const currentUser = JSON.parse(localStorage.getItem('mc_currentUser') || 'null');
        const userKey = currentUser && (currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            ? String(currentUser.username || currentUser.fullName || currentUser.role || currentUser.id)
            : 'guest';
        const legacyKey = 'mc_seen_transaction_keys_v1_' + userKey.replace(/[^a-z0-9_-]/gi, '_');
        addParsed(localStorage.getItem(legacyKey));
    } catch (error) {}

    return keys;
}

function saveSeenTransactionKeysForNotification(keys) {
    const list = Array.from(keys)
        .map(value => String(value || '').trim())
        .filter(Boolean)
        .slice(-2500);
    localStorage.setItem(TRANSACTION_NOTIFICATION_SEEN_KEY, JSON.stringify(list));
}
'@

if (-not $content.Contains($old)) { throw 'Blok storage notifikasi lama tidak ditemukan. File mungkin sudah berubah.' }
$content = $content.Replace($old, $new)

$oldKey = @'
    const key = String(row.itemId || row.id || row.invoiceId || '').trim();
    if (!key) return null;
'@
$newKey = @'
    // Gunakan key yang sama dengan deteksi realtime agar status dismissed
    // identik saat Close dan saat sync ulang.
    const key = getRealtimeTransactionKey(row);
    if (!key) return null;
'@
if (-not $content.Contains($oldKey)) { throw 'Blok transaction payload key tidak ditemukan.' }
$content = $content.Replace($oldKey, $newKey)

$oldClick = @'
        if (payload.id) markTransactionNotificationSeen(payload.id);
        card.classList.toggle('is-open');
'@
$newClick = @'
        // Klik body hanya membuka/menutup detail. Status dismissed baru
        // disimpan ketika user benar-benar menekan tombol Close.
        card.classList.toggle('is-open');
'@
if (-not $content.Contains($oldClick)) { throw 'Blok click notification tidak ditemukan.' }
$content = $content.Replace($oldClick, $newClick)

Set-Content -Path $file -Value $content -Encoding UTF8
node --check $file
Write-Host "OK: sync.js diperbaiki. Backup: $backup"
