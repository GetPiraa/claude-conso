#!/bin/bash
# Installs or updates the "conso" mod for Claude (Code tab) on macOS or Linux.
# Installe ou met à jour le mod "conso" pour Claude (onglet Code) sur macOS ou Linux.
# Ses messages sont en français sur un système en français, en anglais sinon.
# Équivalent de Conso-for-Claude.exe sous Windows : il télécharge la dernière version de ce dépôt,
# copie le mod dans ~/.claude/mods/conso et l'ajoute à CLAUDE_CODE_PLUGIN_DIRS dans ~/.claude/settings.json.
#
# Lancer (et relancer pour mettre à jour) :
#   curl -fsSL https://raw.githubusercontent.com/GetPiraa/claude-conso/main/installer-mac.sh | bash
set -euo pipefail

REPO="GetPiraa/claude-conso"
SOURCE="${CONSO_SOURCE:-https://github.com/$REPO/archive/refs/heads/main.tar.gz}"
CLAUDE="$HOME/.claude"
DEST="$CLAUDE/mods/conso"
# Un premier installeur Mac, fait à la main, plaçait le mod ici : il est retiré pour ne pas le charger deux fois.
ANCIEN="$CLAUDE/conso"
SETTINGS="$CLAUDE/settings.json"

# La langue des messages : CONSO_LANG pour l'imposer, sinon celle du système (réglages du Mac, puis variables du terminal).
LANGUE="${CONSO_LANG:-}"
if [ -z "$LANGUE" ] && command -v defaults >/dev/null 2>&1; then
  LANGUE="$(defaults read -g AppleLanguages 2>/dev/null | tr -d '()" ,\n' | cut -c1-2 || true)"
fi
[ -n "$LANGUE" ] || LANGUE="${LC_ALL:-${LC_MESSAGES:-${LANG:-en}}}"
# dis "texte français" "English text"
dis() { case "$LANGUE" in fr*) printf '%s\n' "$1" ;; *) printf '%s\n' "$2" ;; esac; }

echo
dis "=== Mod Conso pour Claude ===" "=== Conso mod for Claude ==="

if ! command -v node >/dev/null 2>&1; then
  dis "Node.js est introuvable. Le mod en a besoin pour compter les tokens, et cet installeur aussi." "Node.js was not found. The mod needs it to count tokens, and so does this installer."
  dis "Installe-le (brew install node, ou https://nodejs.org) puis relance cette commande." "Install it (brew install node, or https://nodejs.org), then run this command again."
  exit 1
fi

TMP="$(mktemp -d)"
# Lancé par double-clic (fichier .command), le Terminal se fermerait avant qu'on ait lu le résultat : on attend une touche.
fin() {
  rm -rf "$TMP"
  case "$0" in
    *.command) [ -t 0 ] && read -r -p "$(dis "Appuie sur Entrée pour fermer cette fenêtre. " "Press Enter to close this window. ")" _ || true ;;
  esac
}
trap fin EXIT

if [ -f "$SOURCE" ]; then
  cp "$SOURCE" "$TMP/conso.tar.gz"
else
  curl -fsSL "$SOURCE" -o "$TMP/conso.tar.gz" || { dis "Téléchargement impossible depuis GitHub. Vérifie ta connexion et réessaie." "Could not download from GitHub. Check your connection and try again."; exit 1; }
fi
tar -xzf "$TMP/conso.tar.gz" -C "$TMP"
MANIFESTE="$(find "$TMP" -type f -path '*/conso/.claude-plugin/plugin.json' | head -n 1)"
[ -n "$MANIFESTE" ] || { dis "L'archive téléchargée ne contient pas le mod." "The downloaded archive does not contain the mod."; exit 1; }
SRC="$(dirname "$(dirname "$MANIFESTE")")"

version_de() { node -e 'try{console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).version||"0.0.0")}catch{console.log("")}' "$1"; }
NOUVELLE="$(version_de "$MANIFESTE")"
INSTALLEE=""
[ -f "$DEST/.claude-plugin/plugin.json" ] && INSTALLEE="$(version_de "$DEST/.claude-plugin/plugin.json")"

if [ -n "$INSTALLEE" ] && [ "$INSTALLEE" = "$NOUVELLE" ] && [ ! -d "$ANCIEN" ]; then
  dis "Le mod est déjà à jour (version $NOUVELLE)." "The mod is already up to date (version $NOUVELLE)."
  exit 0
fi

if [ -n "$INSTALLEE" ]; then
  dis "Mise à jour : version $INSTALLEE -> $NOUVELLE" "Update: version $INSTALLEE -> $NOUVELLE"
  dis "Tes chiffres, ton historique et les limites déjà apprises sont conservés." "Your figures, your history and the limits already learned are kept."
else
  dis "Installation de la version $NOUVELLE" "Installing version $NOUVELLE"
  dis "1. Le mod est copié dans : $DEST" "1. The mod is copied to: $DEST"
  dis "2. Une ligne est ajoutée à : $SETTINGS (l'ancien fichier est gardé en .avant-conso.bak)" "2. One line is added to: $SETTINGS (the previous file is kept as .avant-conso.bak)"
fi

# Une confirmation, sauf en mode silencieux. Lancé par « curl | bash », le clavier se lit sur le terminal.
if [ -z "${CONSO_SILENT:-}" ]; then
  REPONSE=""
  QUESTION="$(dis "Continuer ? [o/N] " "Continue? [y/N] ")"
  if [ -t 0 ]; then
    read -r -p "$QUESTION" REPONSE
  elif [ -r /dev/tty ]; then
    read -r -p "$QUESTION" REPONSE </dev/tty
  else
    REPONSE="o"
  fi
  case "$REPONSE" in o|O|y|Y|oui|Oui|yes|Yes) ;; *) dis "Annulé." "Cancelled."; exit 0 ;; esac
fi

# 1. Le dossier du mod : l'ancien est retiré en entier, le nouveau prend sa place (sans ses tests).
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SRC/." "$DEST/"
rm -rf "$DEST/tests"
[ -f "$DEST/.claude-plugin/plugin.json" ] || { dis "La copie du mod est incomplète." "The mod was not copied completely."; exit 1; }
rm -rf "$ANCIEN"

# 2. Le réglage qui le charge dans chaque discussion.
if [ -f "$SETTINGS" ] && [ ! -f "$SETTINGS.avant-conso.bak" ]; then
  cp "$SETTINGS" "$SETTINGS.avant-conso.bak"
fi
node -e '
const fs = require("fs"), path = require("path")
const [file, dir, old] = process.argv.slice(1)
let settings = {}
if (fs.existsSync(file)) {
  const raw = fs.readFileSync(file, "utf8")
  if (raw.trim()) settings = JSON.parse(raw)
}
settings.env = settings.env || {}
const same = (a, b) => path.resolve(a) === path.resolve(b)
const dirs = String(settings.env.CLAUDE_CODE_PLUGIN_DIRS || "").split(path.delimiter).filter(d => d && !same(d, dir) && !same(d, old))
dirs.push(dir)
settings.env.CLAUDE_CODE_PLUGIN_DIRS = dirs.join(path.delimiter)
fs.writeFileSync(file, JSON.stringify(settings, null, 2) + "\n")
' "$SETTINGS" "$DEST" "$ANCIEN" || { dis "Impossible de modifier $SETTINGS (fichier illisible ?). Le mod est copié mais pas activé." "Could not change $SETTINGS (unreadable file?). The mod is copied but not enabled."; exit 1; }

echo
dis "Terminé : version $NOUVELLE." "Done: version $NOUVELLE."
dis "Ferme complètement Claude puis relance-le : la bande de conso apparaît au-dessus de la zone de saisie, et /conso ouvre le détail." "Quit Claude completely and start it again: the usage band appears above the prompt box, and /conso opens the details."
dis "Pour mettre à jour plus tard, relance la même commande." "To update later, run the same command again."
