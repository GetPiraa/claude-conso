# Contribuer

Les propositions sont les bienvenues : un bug trouvé, un correctif, une meilleure façon de calculer, la prise en charge d'un autre système.

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

## Changer la pondération des tokens

Les poids (entrée, sortie, cache, par modèle) sont dans `conso/bin/scan.mjs` et `conso/hooks/lib.ts`, et doivent rester identiques dans les deux. Si tu proposes une autre formule, joins les mesures qui la justifient : pourcentages officiels et tokens comptés, sur plusieurs sessions.
