$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$files = @(
    (Join-Path $root 'public\js\sync.js'),
    (Join-Path $root 'public\js\syncantigrafity.js'),
    (Join-Path $root 'public\js\synccodex.js')
)

$keyFunctionPattern = '(?s)function\s+getTransactionNotifyUserKey\s*\(\)\s*\{.*?\}'
$keyFunctionReplacement = @'
function getTransactionNotifyUserKey() {
    return 'mc_seen_transaction_keys_v1__browser__';
}
'@

$clickSeenPattern = '(?m)^\s*if\s*\(payload\.id\)\s+markTransactionNotificationSeen\(payload\.id\);\r?\n'
$legacyAuthorityPattern = '(?s)\r?\n/\* ================================================================\r?\n \* ALMARA - TRANSACTION NOTIFICATION AUTHORITY v2.*?\r?\n\}\)\(\);\r?\n'

$migration = @'
/* ================================================================
 * ALMARA - TRANSACTION NOTIFICATION HISTORY v3
 * One browser-local dismissal history shared by all sync variants.
 * ================================================================ */
(function migrateAlmaraTransactionNotificationHistoryV3() {
    if (window.__almaraTransactionNotificationHistoryV3) return;
    window.__almaraTransactionNotificationHistoryV3 = true;

    const STORAGE_KEY = 'mc_seen_transaction_keys_v1__browser__';
    const LEGACY_PREFIX = 'mc_seen_transaction_keys_v1_';
    const MAX_KEYS = 2500;

    function normalize(value) {
        if (!value) return '';
        if (typeof value === 'object') {
            return String(value.itemId || value.id || value.invoiceId || '').trim();
        }
        return String(value).trim();
    }

    try {
        const merged = new Set();
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (Array.isArray(existing)) {
            existing.forEach(v => {
                const k = normalize(v);
                if (k) merged.add(k);
            });
        }

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || !key.startsWith(LEGACY_PREFIX) || key === STORAGE_KEY) continue;
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(parsed)) {
                    parsed.forEach(v => {
                        const k = normalize(v);
                        if (k) merged.add(k);
                    });
                }
            } catch (_) {}
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(merged).slice(-MAX_KEYS)));
    } catch (error) {
        console.warn('[NotificationHistoryV3] migrasi riwayat gagal:', error);
    }

    console.info('[NotificationHistoryV3] browser-persistent dismissal history ready.');
})();
'@

foreach ($file in $files) {
    if (-not (Test-Path $file)) {
        Write-Warning "File tidak ditemukan: $file"
        continue
    }

    $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    $original = $content

    $content = [regex]::Replace($content, $legacyAuthorityPattern, '', 1)

    if ([regex]::IsMatch($content, $keyFunctionPattern)) {
        $content = [regex]::Replace($content, $keyFunctionPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $keyFunctionReplacement }, 1)
    } else {
        throw "getTransactionNotifyUserKey() tidak ditemukan pada $file"
    }

    $content = [regex]::Replace($content, $clickSeenPattern, '', 1)

    if (-not $content.Contains('ALMARA - TRANSACTION NOTIFICATION HISTORY v3')) {
        $content = $content.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $migration.Trim() + [Environment]::NewLine
    }

    $backup = "$file.before-notification-authority.js"
    if (-not (Test-Path $backup)) {
        Copy-Item -LiteralPath $file -Destination $backup -Force
        Write-Host "BACKUP : $backup"
    }

    if ($content -ne $original) {
        Set-Content -LiteralPath $file -Value $content -Encoding UTF8
        Write-Host "PATCHED: $file"
    } else {
        Write-Host "UNCHANGED: $file"
    }
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