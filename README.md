# Two Words a Day 📖

Deux nouveaux mots d'anglais par jour, plus un entraînement en répétition
espacée pour les réviser toute la journée. Site 100 % statique hébergé sur
GitHub Pages : pas de serveur, pas de base de données, pas de compte à créer.

**Le site :** https://monourhawari.github.io/Vocabulary-english/

---

## Comment ça marche

| Élément | Rôle |
| --- | --- |
| `words.json` | La seule source de vérité : la liste des mots, dans l'ordre d'apparition. |
| `index.html` + `assets/` | Le site (HTML/CSS/JS natif, aucune dépendance, aucun build). |
| `scripts/daily-telegram.mjs` | Poste les 2 mots du jour dans un salon Telegram. |
| `scripts/validate-words.mjs` | Vérifie `words.json` (JSON valide, doublons, champs manquants). |
| `.github/workflows/` | Déploiement Pages, CI sur les PR, envoi Telegram quotidien. |

### Les mots du jour
Le jour 1 correspond à `startDate` dans `words.json`, et chaque jour libère les
2 entrées suivantes de la liste. Tout le monde voit donc **les mêmes mots le
même jour**, sans aucune coordination. Les mots pas encore sortis ne sont pas
affichés dans la bibliothèque — pas de spoiler.

> ⚠️ La liste est **append-only** : ajoute toujours les nouveaux mots **à la
> fin**. Insérer un mot au milieu décale le calendrier de tous les jours
> suivants.

### L'entraînement
Trois niveaux de difficulté, mélangés automatiquement :

- **Flashcard** — le mot seul, tu te rappelles le sens, puis tu te notes.
- **QCM** — une définition, quatre mots, tu choisis (clavier : `1`–`4`).
- **Répétition espacée** — un mot réussi revient après 1, 2, 4, 8, 16 puis
  32 jours ; un mot raté retombe au niveau 0 et revient dans la session.
  C'est ce qui fait que tu révises les anciens mots sans y penser.

La progression est stockée dans le `localStorage` du navigateur : chacun a la
sienne, rien n'est envoyé nulle part. Changer de navigateur = repartir de zéro.

---

## Ajouter des mots

Ajoute un objet à la fin du tableau `words` de `words.json` :

```json
{
  "word": "tedious",
  "pos": "adjective",
  "ipa": "/ˈtiː.di.əs/",
  "definition": "boring and tiring because it takes a long time and never changes.",
  "examples": [
    "Renaming the columns by hand was tedious but necessary.",
    "He explained the whole history in tedious detail."
  ],
  "synonyms": ["dull", "monotonous"],
  "collocations": ["a tedious task", "tedious work"]
}
```

Seuls `word`, `pos` et `definition` sont obligatoires, mais mets au moins un
exemple : c'est l'exemple qui fait retenir le mot, pas la définition.

Règles de style pour rester dans l'esprit « immersion » :

- Définitions et exemples **en anglais simple** — pas de traduction.
- Des exemples qui ressemblent à votre vraie vie de bureau, pas des phrases
  de dictionnaire.
- Vérifie avant de pousser :

  ```bash
  node scripts/validate-words.mjs
  ```

Le plus sain pour un groupe : une **Pull Request** par lot de mots. La CI
valide le fichier, un collègue relit, on merge, le site se redéploie tout seul.

---

## Mise en route (une seule fois)

### 1. Activer GitHub Pages
`Settings` → `Pages` → **Source : GitHub Actions**. Pousse sur `main` : le
workflow `Deploy site` publie le site. URL :
`https://<utilisateur>.github.io/<repo>/`.

### 2. Brancher Telegram (optionnel mais recommandé)
Un site, on oublie de l'ouvrir. Un message dans le salon où vous êtes déjà
toute la journée, ça crée l'habitude.

1. Sur Telegram, parle à [@BotFather](https://t.me/BotFather) → `/newbot` →
   note le **token**.
2. Crée un groupe avec tes collègues et ajoute-y le bot.
3. Récupère l'id du groupe : envoie un message dans le groupe, puis ouvre
   `https://api.telegram.org/bot<TOKEN>/getUpdates` et lis
   `result[0].message.chat.id` (il commence par `-` pour un groupe).
4. Dans le repo : `Settings` → `Secrets and variables` → `Actions` →
   **New repository secret**, deux fois :
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
5. Toujours là, onglet **Variables** → `SITE_URL` = l'URL du site (sinon elle
   est devinée depuis le nom du repo).
6. Teste sans attendre demain : onglet `Actions` → `Words of the day` →
   **Run workflow**.

L'horaire est dans `.github/workflows/daily-telegram.yml` (cron en **UTC**).

### 3. Changer la date de départ
`startDate` dans `words.json` = le jour 1. Mets la date à laquelle vous
commencez vraiment.

---

## Développer en local

Aucune dépendance à installer. Il faut juste un serveur HTTP, car le site
charge `words.json` en `fetch` (ça ne marche pas en `file://`) :

```bash
python3 -m http.server 8000
# puis http://localhost:8000
```

Pour voir le message Telegram du jour sans l'envoyer :

```bash
node scripts/daily-telegram.mjs --dry-run
```

---

## Idées pour plus tard

- Série de jours consécutifs (streak) et statistiques de progression.
- Mode audio : prononciation et dictée via la synthèse vocale du navigateur
  (gratuite, sans clé API).
- Phrase à trous à partir des exemples.
- Classement partagé entre collègues — demande un petit backend, contrairement
  à tout le reste.
