$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$files = @(
    (Join-Path $root 'public\js\sync.js'),
    (Join-Path $root 'public\js\syncantigrafity.js'),
    (Join-Path $root 'public\js\synccodex.js')
)

$patch = @'

/* ================================================================
 * ALMARA - TRANSACTION NOTIFICATION AUTHORITY v2
 * One browser-local dismissal history shared by all sync variants.
 * IMPORTANT: this patch is intentionally appended so it overrides
 * duplicate notification helpers without rewriting the sync engine.
 * ================================================================ */
(function installAlmaraTransactionNotificationAuthority() {
    if (window.__almaraTransactionNotificationAuthorityV2) return;
    window.__almaraTransactionNotificationAuthorityV2 = true;

    const STORAGE_KEY = 'mc_seen_transaction_keys_v1__browser__';
    const MAX_KEYS = 2500;

    function readKeys() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = JSON.parse(raw || '[]');
            return new Set(Array.isArray(parsed) ? parsed.map(v => String(v).trim()).filter(Boolean) : []);
        } catch (error) {
            console.warn('[NotificationAuthority] gagal membaca dismissed keys:', error);
            return new Set();
        }
    }

    function writeKeys(keys) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(keys).filter(Boolean).slice(-MAX_KEYS)));
        } catch (error) {
            console.warn('[NotificationAuthority] gagal menyimpan dismissed keys:', error);
        }
    }

    function transactionKey(value) {
        if (!value) return '';
        if (typeof value === 'object') {
            return String(value.itemId || value.id || value.invoiceId || '').trim();
        }
        return String(value).trim();
    }

    // Migrate all existing per-user v1 histories into one browser history.
    try {
        const merged = readKeys();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith('mc_seen_transaction_keys_v1_') || key === STORAGE_KEY) continue;
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(parsed)) parsed.forEach(v => {
                    const normalized = transactionKey(v);
                    if (normalized) merged.add(normalized);
                });
            } catch (_) {}
        }
        writeKeys(merged);
    } catch (_) {}

    // Override the shared helpers used by all three sync variants.
    window.getTransactionNotifyUserKey = function() {
        return STORAGE_KEY;
    };

    window.getSeenTransactionKeysForNotification = function() {
        return readKeys();
    };

    window.saveSeenTransactionKeysForNotification = function(keys) {
        writeKeys(keys instanceof Set ? keys : new Set(Array.isArray(keys) ? keys : []));
    };

    window.getTransactionNotificationDismissedSet = function() {
        return readKeys();
    };

    window.markTransactionNotificationSeen = function(key) {
        const normalized = transactionKey(key);
        if (!normalized) return;
        const dismissed = readKeys();
        dismissed.add(normalized);
        writeKeys(dismissed);
        if (typeof window.getTransactionNotificationActiveSet === 'function') {
            window.getTransactionNotificationActiveSet().delete(normalized);
        }
    };

    window.markTransactionNotificationSeenMany = function(keys) {
        const dismissed = readKeys();
        (Array.isArray(keys) ? keys : []).forEach(key => {
            const normalized = transactionKey(key);
            if (normalized) dismissed.add(normalized);
        });
        writeKeys(dismissed);
    };

    // Existing renderer calls this helper before displaying a transaction.
    window.__almaraNotificationAlreadyDismissed = function(key) {
        const normalized = transactionKey(key);
        return !!normalized && readKeys().has(normalized);
    };

    console.info('[NotificationAuthority] v2 active; dismissed transaction history is browser-persistent.');
})();
'@

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Warning "File tidak ditemukan: $file"
        continue
    }

    $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    $marker = 'ALMARA - TRANSACTION NOTIFICATION AUTHORITY v2'
    if ($content.Contains($marker)) {
        Write-Host "SKIP: patch sudah ada -> $file"
        continue
    }

    $backup = "$file.before-notification-authority.js"
    Copy-Item -LiteralPath $file -Destination $backup -Force
    Add-Content -LiteralPath $file -Value $patch -Encoding UTF8
    Write-Host "PATCHED: $file"
    Write-Host "BACKUP : $backup"
}

if (Get-Command node -ErrorAction SilentlyContinue) {
    foreach ($file in $files) {
        if (Test-Path $file) {
            node --check $file
            if ($LASTEXITCODE -ne 0) { throw "Syntax error pada $file" }
        }
    }
    Write-Host 'OK: seluruh file JS lolos node --check.'
} else {
    Write-Warning 'Node.js tidak ditemukan; syntax check dilewati.'
}

Write-Host ''
Write-Host 'SELESAI. Jalankan php artisan optimize:clear lalu Ctrl+F5.'
