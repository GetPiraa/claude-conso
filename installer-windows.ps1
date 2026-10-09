# Installs or updates the "conso" mod for Claude (Code tab) on Windows, with nothing to download by hand.
# Installe ou met à jour le mod "conso" pour Claude (onglet Code) sous Windows, sans rien télécharger à la main.
#
# It does what the double-click installer does: it fetches the latest version of this repository, copies the mod
# into %USERPROFILE%\.claude\mods\conso and adds it to CLAUDE_CODE_PLUGIN_DIRS in settings.json.
# Messages are in French on a French system, in English otherwise.
#
# Run it (and run it again to update), in PowerShell:
#   irm https://raw.githubusercontent.com/GetPiraa/claude-conso/main/installer-windows.ps1 | iex
& {
    $ErrorActionPreference = 'Stop'
    $source = if ($env:CONSO_SOURCE) { $env:CONSO_SOURCE } else { 'https://github.com/GetPiraa/claude-conso/archive/refs/heads/main.zip' }
    $claude = Join-Path $env:USERPROFILE '.claude'
    $target = Join-Path $claude 'mods\conso'
    $settingsPath = Join-Path $claude 'settings.json'
    $key = 'CLAUDE_CODE_PLUGIN_DIRS'
    $work = Join-Path ([IO.Path]::GetTempPath()) ('conso-' + [Guid]::NewGuid().ToString('N'))
    # La langue des messages : celle du système, ou CONSO_LANG pour l'imposer.
    $lang = if ($env:CONSO_LANG) { $env:CONSO_LANG } else { (Get-UICulture).Name }
    $isFrench = $lang -like 'fr*'
    function Say($fr, $en) { if ($isFrench) { $fr } else { $en } }

    Write-Host ''
    Write-Host (Say '=== Mod Conso pour Claude ===' '=== Conso: live token usage for Claude ===')
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
                throw (Say 'Téléchargement impossible depuis GitHub. Vérifie ta connexion et réessaie.' 'Could not download from GitHub. Check your connection and try again.')
            }
        }
        Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $work 'archive')

        # Dans l'archive, le mod est le dossier « conso » qui porte un manifeste de plugin.
        $found = Get-ChildItem -Path (Join-Path $work 'archive') -Recurse -Filter 'plugin.json' |
            Where-Object { $_.Directory.Name -eq '.claude-plugin' -and $_.Directory.Parent.Name -eq 'conso' } |
            Select-Object -First 1
        if (-not $found) { throw (Say "L'archive téléchargée ne contient pas le mod." 'The downloaded archive does not contain the mod.') }
        $src = $found.Directory.Parent.FullName
        $versionOf = { param($file) try { [string](Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json).version } catch { '' } }
        $new = & $versionOf $found.FullName
        $manifest = Join-Path $target '.claude-plugin\plugin.json'
        $installed = if (Test-Path -LiteralPath $manifest) { & $versionOf $manifest } else { $null }

        if ($installed -and $installed -eq $new) {
            Write-Host (Say "Le mod est déjà à jour (version $new)." "The mod is already up to date (version $new).")
            return
        }
        if ($installed) {
            Write-Host (Say "Mise à jour : version $installed -> $new" "Update: version $installed -> $new")
            Write-Host (Say 'Tes chiffres, ton historique et les limites déjà apprises sont conservés.' 'Your figures, your history and the limits already learned are kept.')
        } else {
            Write-Host (Say "Installation de la version $new" "Installing version $new")
            Write-Host (Say "1. Le mod est copié dans : $target" "1. The mod is copied to: $target")
            Write-Host (Say "2. Une ligne est ajoutée à : $settingsPath (l'ancien fichier est gardé en .avant-conso.bak)" "2. One line is added to: $settingsPath (the previous file is kept as .avant-conso.bak)")
        }
        if (-not $env:CONSO_SILENT) {
            $answer = Read-Host (Say 'Continuer ? [o/N]' 'Continue? [y/N]')
            if ($answer -notmatch '^(o|oui|y|yes)$') {
                Write-Host (Say 'Annulé.' 'Cancelled.')
                return
            }
        }

        # 1. Le dossier du mod : l'ancien est retiré en entier, le nouveau prend sa place (sans ses tests).
        if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
        New-Item -ItemType Directory -Path $target -Force | Out-Null
        Copy-Item -Path (Join-Path $src '*') -Destination $target -Recurse -Force
        $tests = Join-Path $target 'tests'
        if (Test-Path -LiteralPath $tests) { Remove-Item -LiteralPath $tests -Recurse -Force }
        if (-not (Test-Path -LiteralPath $manifest)) { throw (Say 'La copie du mod est incomplète.' 'The mod was not copied completely.') }

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
        Write-Host (Say "Terminé : version $new." "Done: version $new.")
        Write-Host (Say 'Ferme complètement Claude puis relance-le : la bande de conso apparaît au-dessus de la zone de saisie, et /conso ouvre le détail.' 'Quit Claude completely and start it again: the usage band appears above the prompt box, and /conso opens the details.')
        Write-Host (Say 'Pour mettre à jour plus tard, relance la même commande.' 'To update later, run the same command again.')
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-Host (Say 'Attention : Node.js est introuvable. Le mod en a besoin pour compter les tokens. Installe-le depuis https://nodejs.org puis relance Claude.' 'Warning: Node.js was not found. The mod needs it to count tokens. Install it from https://nodejs.org, then restart Claude.') -ForegroundColor Yellow
        }
    } catch {
        Write-Host ((Say "L'installation a échoué : " 'The installation failed: ') + $_.Exception.Message) -ForegroundColor Red
    } finally {
        if (Test-Path -LiteralPath $work) { Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue }
    }
}
