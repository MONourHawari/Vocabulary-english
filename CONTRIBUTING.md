# Contribuer

Merci 🙌 Une contribution ici, c'est presque toujours « j'ajoute des mots ».

## Ajouter des mots

1. Crée une branche.
2. Ajoute tes entrées **à la fin** du tableau `words` de `words.json`
   (la liste est append-only : insérer au milieu décale le calendrier de tous
   les jours suivants).
3. Respecte le format — `word`, `pos`, `definition` obligatoires, au moins un
   exemple recommandé. Le modèle complet est dans le
   [README](README.md#ajouter-des-mots).
4. Vérifie le fichier :

   ```bash
   node scripts/validate-words.mjs
   ```

5. Ouvre une Pull Request. La CI rejoue la validation et affiche le message
   Telegram du jour.

## Style

- Tout en **anglais simple** : définitions, exemples, synonymes. Pas de
  traduction, c'est volontaire.
- Des exemples qui pourraient sortir de vos vraies réunions.
- Un mot par entrée, pas de doublon (le validateur les attrape).
- Pas de mot rare pour impressionner : on veut des mots qu'on réutilise
  dans la semaine.

## Code

Le site est du HTML/CSS/JS natif, sans build ni dépendance. Garde-le comme ça :
la barrière d'entrée basse, c'est la fonctionnalité principale du projet.
