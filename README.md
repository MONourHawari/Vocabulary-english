# Two Words a Day 📖

Deux nouveaux mots d'anglais par jour, plus un entraînement en répétition
espacée pour les réviser toute la journée. Site 100 % statique hébergé sur
GitHub Pages : pas de serveur, pas de base de données, pas de compte à créer.

**Le site :** https://monourhawari.github.io/Vocabulary-english/

---

## Comment ça marche

| Élément | Rôle |
| --- | --- |
| `words.json` | La seule source de vérité : les mots, par semaine-thème, dans l'ordre d'apparition. |
| `index.html` + `assets/` | Le site (HTML/CSS/JS natif, aucune dépendance, aucun build). |
| `scripts/daily-telegram.mjs` | Poste les 2 mots du jour dans un salon Telegram, avec un rappel à trou de la veille. |
| `scripts/validate-words.mjs` | Vérifie `words.json` : format, doublons, et les règles d'apprentissage (voir `CONTRIBUTING.md`). |
| `.github/workflows/` | Déploiement Pages, CI sur les PR, envoi Telegram quotidien. |

### Une semaine = une situation
Le jour 1 est `startDate` (un lundi). Chaque jour libère les 2 entrées
suivantes ; chaque semaine de 14 entrées porte un **thème = une situation de
bureau** (« Stand-up and status updates », « Asking for clarification »,
« Pushing back politely », « Something broke »…). Tout le monde voit donc
**les mêmes mots le même jour**, dans la même scène, sans coordination.

Pourquoi une *situation* et pas une *catégorie* (« les mots de la réunion ») :
apprendre ensemble des mots qui se ressemblent fait qu'on les confond. Dans une
semaine « retard », on aura *postpone* (verbe), *setback* (nom), *overdue*
(adjectif), *catch up* (verbe à particule) — même scène, rien qui se ressemble.
Les règles complètes, et pourquoi on évite les mots que les francophones
lisent déjà gratuitement, sont dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

> ⚠️ La liste est **append-only** : ajoute toujours une semaine **à la fin**.
> Insérer au milieu décale le calendrier de tous les jours suivants.

### L'entraînement
- **Première rencontre** : la fiche complète (sens, prononciation 🔊, exemples,
  tournures, piège éventuel), puis une question tout de suite.
- **Cartes jeunes** : QCM avec des leurres de même nature grammaticale.
- **Cartes mûres** : tu **tapes** le mot dans un trou de sa phrase d'exemple —
  reconnaître ne suffit pas, il faut produire.
- **Répétition espacée** : 1, 3, 7, 14, 30, 60 puis 120 jours ; un échec fait
  redescendre de deux barreaux. 20 cartes max par session, le reste attend.

La progression est stockée dans le `localStorage` du navigateur : chacun a la
sienne, rien n'est envoyé nulle part. Changer de navigateur = repartir de zéro.

### Le rythme du groupe
- **08 h** — le bot Telegram poste les deux mots, leur mission du jour, et un
  rappel à trou des mots de la veille (réponse cachée, on tape pour voir).
- **Dans la journée** — chacun fait sa session (5 min) et **répond au message
  du bot avec une phrase** qui utilise l'un des deux mots, sur quelque chose
  de vrai. C'est la seule « note » qui compte, et c'est de la correction
  gratuite entre collègues. On ne corrige que le mot du jour, jamais le reste.
- **Vendredi** — paire légère, utilisable dans le bilan de la semaine.
- **Week-end** — paires légères (small talk du lundi matin) : pas de mur de
  révisions le lundi.

---

## Les 26 semaines

Six mois de contenu sont en place (364 entrées). Chaque semaine = une
situation ; le jeudi porte le faux ami de la semaine.

| Semaine | Situation | Faux ami |
| --- | --- | --- |
| 1 | Stand-up and status updates | delay |
| 2 | Asking for clarification | eventually |
| 3 | Pushing back politely | actually |
| 4 | Something broke | sensible |
| 5 | Planning the sprint | tentative |
| 6 | Code review and giving feedback | comprehensive |
| 7 | Writing to a client | demand |
| 8 | Running a meeting | agenda |
| 9 | Deadlines and priorities | actual |
| 10 | Numbers and data | figure |
| 11 | Explaining a decision | consistent |
| 12 | Onboarding a newcomer | attend |
| 13 | Remote-work small talk | sympathetic |
| 14 | Cost, effort and budget | billion |
| 15 | Post-mortem and lessons learned | resume |
| 16 | Asking for and giving help | assist |
| 17 | Negotiating scope with a client | pretend |
| 18 | Hiring and interviews | resign |
| 19 | One-to-ones and feedback on people | confidence |
| 20 | Presenting a demo | prevent |
| 21 | Handling an unhappy client | deceive |
| 22 | Documentation and handover | library |
| 23 | Travel and office logistics | location |
| 24 | Security and access | control |
| 25 | Roadmap and strategy | achieve |
| 26 | Closing a project | rest |

Les niveaux CECR et les listes d'origine (`level`, `source`) ont été
attribués de mémoire, pas vérifiés un par un sur l'Oxford Learner's
Dictionary : si un mot te paraît mal classé, corrige-le dans une PR — c'est
exactement le genre de relecture qu'un collègue peut faire en cinq minutes.

---

## Ajouter des mots

Voir [`CONTRIBUTING.md`](CONTRIBUTING.md) : une contribution = une semaine de
14 entrées, une situation, un lundi. Le format d'une entrée, les critères de
choix et les règles d'interférence y sont détaillés. Vérifie avant de pousser :

```bash
node scripts/validate-words.mjs
```

---

## Mise en route (une seule fois)

### 1. Activer GitHub Pages
`Settings` → `Pages` → *Build and deployment* → **Source : GitHub Actions**.
Cette étape est obligatoire et ne peut pas être automatisée : le jeton du
workflow n'a pas le droit de créer le site Pages (erreur
`Resource not accessible by integration` sinon). Ensuite, chaque push sur
`main` publie le site via le workflow `Deploy site` — ou lance-le à la main
depuis l'onglet `Actions` la première fois. URL :
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
node scripts/daily-telegram.mjs --dry-run            # aujourd'hui
node scripts/daily-telegram.mjs --dry-run --day 3    # un jour précis (0 = jour 1)
```

---

## Idées pour plus tard

- Série de jours consécutifs (streak) **privée** — jamais de classement
  partagé : ça fait taire ceux qui décrochent au lieu de les ramener.
- Mode dictée : on entend le mot, on l'écrit.
- Rappel Telegram de 16 h avec le trou de la veille pour une deuxième
  récupération dans la journée.
- Un « jour de révision » automatique quand la liste est à court de semaines
  (le bot le fait déjà ; le site pourrait en faire autant).
