# Contribuer

[English](CONTRIBUTING.md) · **Français**

Les propositions sont les bienvenues : un bug trouvé, un correctif, une meilleure façon de calculer, la prise en charge d'un autre système, une nouvelle langue.

## Signaler un problème

Ouvre une [issue](../../issues) en précisant :

- ton système (Windows, macOS, Linux) et la version du mod, affichée en bas du panneau ;
- ce que tu attendais et ce qui s'est passé, avec une capture si c'est un souci d'affichage.

## Proposer une modification

1. Fais un fork du dépôt et crée une branche.
2. Modifie le mod dans `conso/`. L'affichage est dans `conso/hooks/`, le comptage dans `conso/bin/scan.mjs`.
3. Lance les tests depuis `conso/` :

   ```bash
   claude plugin validate .
   claude plugin test .
   ```

4. Ouvre une pull request en expliquant le problème réglé et comment tu l'as vérifié.

Quelques règles simples :

- **Une proposition, un sujet.** Un correctif et une nouveauté font deux pull requests.
- **Un test pour chaque correction de comportement**, dans `conso/tests/`.
- **Rien n'est envoyé sur Internet par le mod.** Une proposition qui ajoute un appel réseau, lit autre chose que les transcripts de Claude Code ou touche à d'autres réglages sera refusée.
- **Ne monte pas le numéro de version** : il est changé au moment de la publication.

Chaque proposition est relue et testée avant d'être intégrée, parce que tout ce qui arrive sur la branche `main` est installé chez les utilisateurs à leur prochaine mise à jour.

## Ajouter ou corriger une langue

Chaque langue est un fichier de `conso/hooks/lang/` (`fr.ts`, `de.ts`…). Entre les accolades, c'est du JSON strict : le mod lit le fichier comme un texte, seulement quand la langue sert.

- Pour corriger une traduction, modifie le texte dans le fichier de la langue.
- Pour ajouter une langue, copie `fr.ts`, traduis les valeurs en gardant chaque clé et chaque emplacement (`{0}`, `{1}`…), puis ajoute son code au type `Lang` et à `LANGS` dans `conso/hooks/i18n.ts`, ses quelques textes à `TEXTS` dans `conso/bin/scan.mjs`, et son fichier à `conso/tests/langs.ts`.
- Les quatre noms de `parts` doivent tenir en 19 caractères : la légende de l'anneau n'en montre pas davantage.

Les tests vérifient que chaque langue a les mêmes clés et les mêmes emplacements.

## Changer la pondération des tokens

Les poids (entrée, sortie, cache, par modèle) sont dans `conso/bin/scan.mjs` et `conso/hooks/lib.ts`, et doivent rester identiques dans les deux. Si tu proposes une autre formule, joins les mesures qui la justifient : pourcentages officiels et tokens comptés, sur plusieurs sessions.
