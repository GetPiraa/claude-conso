# Installe ou met à jour le mod "conso" pour Claude (onglet Code) sous Windows, sans rien télécharger à la main.
# Il fait la même chose que Conso-pour-Claude.exe : il récupère la dernière version de ce dépôt,
# copie le mod dans %USERPROFILE%\.claude\mods\conso et l'ajoute à CLAUDE_CODE_PLUGIN_DIRS dans settings.json.
#
# Lancer (et relancer pour mettre à jour), dans PowerShell :
#   irm https://raw.githubusercontent.com/GetPiraa/claude-conso/main/installer-windows.ps1 | iex
& {
    $ErrorActionPreference = 'Stop'
    $source = if ($env:CONSO_SOURCE) { $env:CONSO_SOURCE } else { 'https://github.com/GetPiraa/claude-conso/archive/refs/heads/main.zip' }
    $claude = Join-Path $env:USERPROFILE '.claude'
    $target = Join-Path $claude 'mods\conso'
    $settingsPath = Join-Path $claude 'settings.json'
    $key = 'CLAUDE_CODE_PLUGIN_DIRS'
    $work = Join-Path ([IO.Path]::GetTempPath()) ('conso-' + [Guid]::NewGuid().ToString('N'))

    Write-Host ''
    Write-Host '=== Mod Conso pour Claude ==='
    try {
        New-Item -ItemType Directory -Path $work | Out-Null
        $zip = Join-Path $work 'conso.zip'
        if (Test-Path -LiteralPath $source -PathType Leaf) {
            Copy-Item -LiteralPath $source -Destination $zip
        } else {
            [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
            try {
                (New-Object Net.WebClient).DownloadFile($source, $zip)
            } catch {
                throw 'Téléchargement impossible depuis GitHub. Vérifie ta connexion et réessaie.'
            }
        }
        Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $work 'archive')

        # Dans l'archive, le mod est le dossier « conso » qui porte un manifeste de plugin.
        $found = Get-ChildItem -Path (Join-Path $work 'archive') -Recurse -Filter 'plugin.json' |
            Where-Object { $_.Directory.Name -eq '.claude-plugin' -and $_.Directory.Parent.Name -eq 'conso' } |
            Select-Object -First 1
        if (-not $found) { throw "L'archive téléchargée ne contient pas le mod." }
        $src = $found.Directory.Parent.FullName
        $versionOf = { param($file) try { [string](Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch { '' } }
        $new = & $versionOf $found.FullName
        $manifest = Join-Path $target '.claude-plugin\plugin.json'
        $installed = if (Test-Path -LiteralPath $manifest) { & $versionOf $manifest } else { $null }

        if ($installed -and $installed -eq $new) {
            Write-Host "Le mod est déjà à jour (version $new)."
            return
        }
        if ($installed) {
            Write-Host "Mise à jour : version $installed -> $new"
            Write-Host 'Tes chiffres, ton historique et les limites déjà apprises sont conservés.'
        } else {
            Write-Host "Installation de la version $new"
            Write-Host "1. Le mod est copié dans : $target"
            Write-Host "2. Une ligne est ajoutée à : $settingsPath (l'ancien fichier est gardé en .avant-conso.bak)"
        }
        if (-not $env:CONSO_SILENT) {
            $answer = Read-Host 'Continuer ? [o/N]'
            if ($answer -notmatch '^(o|oui|y|yes)$') {
                Write-Host 'Annulé.'
                return
            }
        }

        # 1. Le dossier du mod : l'ancien est retiré en entier, le nouveau prend sa place (sans ses tests).
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Copy-Item -Path (Join-Path $src '*') -Destination $target -Recurse -Force
        $tests = Join-Path $target 'tests'
        if (Test-Path -LiteralPath $tests) { Remove-Item -LiteralPath $tests -Recurse -Force }
        if (-not (Test-Path -LiteralPath $manifest)) { throw 'La copie du mod est incomplète.' }

        # 2. Le réglage qui le charge dans chaque discussion.
        $settings = New-Object PSObject
        if (Test-Path -LiteralPath $settingsPath) {
            $backup = "$settingsPath.avant-conso.bak"
            if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $settingsPath -Destination $backup }
            $raw = Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8
            if ($raw -and $raw.Trim()) { $settings = $raw | ConvertFrom-Json }
        }
        if (-not ($settings.PSObject.Properties.Name -contains 'env') -or $null -eq $settings.env) {
            $settings | Add-Member -NotePropertyName env -NotePropertyValue (New-Object PSObject) -Force
        }
        $current = if ($settings.env.PSObject.Properties.Name -contains $key) { [string]$settings.env.$key } else { '' }
        $dirs = @($current.Split(';') | Where-Object { $_ -and $_ -ne $target }) + $target
        $wanted = $dirs -join ';'
        if ($wanted -ne $current) {
            $settings.env | Add-Member -NotePropertyName $key -NotePropertyValue $wanted -Force
            [IO.File]::WriteAllText($settingsPath, (($settings | ConvertTo-Json -Depth 50) + "`n"), (New-Object Text.UTF8Encoding($false)))
        }

        Write-Host ''
        Write-Host "Terminé : version $new."
        Write-Host 'Ferme complètement Claude puis relance-le : la bande de conso apparaît au-dessus de la zone de saisie, et /conso ouvre le détail.'
        Write-Host 'Pour mettre à jour plus tard, relance la même commande.'
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Host 'Attention : Node.js est introuvable. Le mod en a besoin pour compter les tokens. Installe-le depuis https://nodejs.org puis relance Claude.' -ForegroundColor Yellow
        }
    } catch {
        Write-Host "L'installation a échoué : $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    }
}
