"""Fabrique Conso-pour-Claude-mac.zip : l'installeur Mac en double-clic.

Le zip contient « Installer Conso.command », copie de installer-mac.sh marquée exécutable,
pour que le Finder le lance dans le Terminal. À lancer depuis la racine du dépôt.
"""
import io
import zipfile

script = io.open('installer-mac.sh', encoding='utf-8').read().replace('\r\n', '\n').encode('utf-8')
notice = (
    "Double-clique sur « Installer Conso.command ».\n\n"
    "Si macOS refuse de l'ouvrir (développeur non identifié) :\n"
    "clic droit sur le fichier > Ouvrir, puis de nouveau Ouvrir.\n\n"
    "Pour mettre à jour plus tard, relance le même fichier.\n"
).encode('utf-8')

with zipfile.ZipFile('Conso-pour-Claude-mac.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for name, data, mode in [('Installer Conso.command', script, 0o755), ('LISEZ-MOI.txt', notice, 0o644)]:
        entry = zipfile.ZipInfo('Conso-pour-Claude-mac/' + name, date_time=(2026, 10, 9, 12, 0, 0))
        entry.create_system = 3  # Unix : c'est ce qui fait retenir le droit d'exécution au Finder
        entry.external_attr = (0o100000 | mode) << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(entry, data)
print('Conso-pour-Claude-mac.zip est prêt.')
