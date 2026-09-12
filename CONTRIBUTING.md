# Contribuer : ajouter une semaine de mots

Une contribution ici, c'est une **semaine** : 14 entrées, une situation de
bureau, un lundi. Ce fichier explique *comment* choisir les mots. Le
validateur (`node scripts/validate-words.mjs`) vérifie tout ce qu'un script
peut vérifier ; le reste, c'est la relecture.

## Pourquoi ces règles

Vous êtes francophones, niveau B1–B2. Vous **lisez déjà gratuitement** les mots
d'origine latine : *feasible, robust, mitigate, clarify, redundant* — c'est du
français avec un accent. Une liste pleine de ces mots donne de bons scores au
QCM et ne change rien à votre prochain stand-up.

Ce qui vous manque vraiment, c'est ce que vous ne *produisez* pas :

- les mots courts d'origine germanique (*hurdle, leeway, tricky, hassle*) ;
- les verbes à particule (*figure out, sort out, point out, get back to*) ;
- les tournures toutes faites (*so far, heads-up, on track, fair enough*) ;
- les adoucisseurs qui évitent de sonner brutal (*I'd rather, I'm not sure that…*) ;
- les faux amis qui vous font dire autre chose (*actually, eventually, delay,
  sensible*).

Chaque entrée doit acheter quelque chose **dans ce trou-là**.

Deuxième point, contre-intuitif mais mesuré depuis les années 90 : apprendre
ensemble deux mots qui se ressemblent (*mitigate* / *alleviate*, *bottleneck* /
*blocker*, *adapt* / *adopt*) fait qu'on les **confond**, durablement. D'où :
une semaine = une **situation** (pas une catégorie), et les deux mots d'un jour
n'ont rien en commun sauf la scène.

## La semaine : une situation, 7 jours, 2 entrées par jour

L'ordre dans `words.json` est l'ordre d'apparition : entrées 0–1 = lundi,
2–3 = mardi, … 12–13 = dimanche. Toute la semaine porte le même `theme`.

| Jour | Contenu |
| --- | --- |
| Lun–Jeu | Une **ancre** + un **partenaire**. L'ancre est opaque pour un francophone : mot germanique, verbe à particule ou tournure. Le partenaire est d'une autre nature grammaticale, tiré de la même scène mais d'une autre idée, et plus léger. |
| Jeudi | Porte **le** faux ami de la semaine (`cognate: "false-friend"` + `trap`). |
| Vendredi | Paire légère, orale, utilisable dans le bilan du vendredi. Pas de faux ami. |
| Sam–Dim | Paires légères : tournures du quotidien, small talk du lundi 9 h 05. Rien d'abstrait. |

Quotas par semaine :

- au moins 3 verbes à particule ou tournures (`type` ≠ `"word"`) ;
- exactement 1 faux ami ;
- 0 cognat transparent (`cognate: "transparent"` est refusé) ;
- au moins 3 natures grammaticales différentes ;
- jamais deux entrées de même `pos` **et** même `type` le même jour.

## Choisir un mot

Un mot est accepté si **une** de ces conditions tient, et on la note dans `source` :

| `source` | Condition |
| --- | --- |
| `"Oxford 5000"` | Le mot est marqué **B2 ou C1** dans l'Oxford 5000 (le niveau s'affiche à côté du mot sur oxfordlearnersdictionaries.com). |
| `"Oxford 3000"` | Seulement pour un faux ami ou un second sens d'un mot connu — avec un `trap` obligatoire. |
| `"PHaVE"` | Verbe à particule de la liste PHaVE (les 150 plus fréquents), enseigné dans son sens le plus fréquent. |
| `"everyday"` | Tournure figée que n'importe quel collègue anglophone dit chaque semaine (*so far, heads-up, on track*). |

On refuse : ce que le groupe lit déjà (cognats transparents), le rare et le
littéraire (*albeit, hereby, serendipity*), l'argot, et les mots de LinkedIn
qu'un ingénieur natif ne dit qu'au second degré (*leverage, synergy, circle
back, touch base*). Et le test ultime : **si tu ne peux pas écrire une phrase
qu'un collègue dirait demain au bureau, le mot ne rentre pas.**

## Les règles d'interférence (vérifiées par le script)

- Deux entrées à moins de 14 jours ne peuvent pas être quasi-synonymes : ni
  l'une dans les `synonyms` de l'autre, ni un synonyme partagé.
- Deux mots simples à moins de 14 jours ne peuvent pas se ressembler
  (*adapt / adopt, ensure / assure*).
- Deux verbes à particule avec la même particule : 7 jours d'écart minimum.
- Un sens par entrée. La définition et les deux exemples montrent **un** sens.
- Pas d'antonymes ni de membres d'une même série fermée le même jour.

## Le format d'une entrée

```json
{
  "word": "figure out",
  "type": "phrasal-verb",
  "pos": "verb",
  "ipa": "/ˌfɪɡ.ər ˈaʊt/",
  "theme": "Stand-up and status updates",
  "level": "B2",
  "source": "PHaVE",
  "cognate": "none",
  "definition": "to understand or find the answer to something after thinking about it.",
  "examples": [
    "I'm still figuring out why the build fails.",
    "We figured out the cause after two hours of digging."
  ],
  "forms": ["figuring out", "figured out", "figures out"],
  "collocations": ["figure out why", "figure out how to", "figure it out"],
  "synonyms": ["work out"],
  "mission": "Say what you are still figuring out in today's stand-up."
}
```

| Champ | Règle |
| --- | --- |
| `word` | Le mot-vedette. Verbes à particule sans *to* (`figure out`). Tournures : la partie fixe seulement, sans crochets (`get back to`, pas `get back to [someone]`). Orthographe britannique. |
| `type` | `word`, `phrasal-verb` ou `chunk`. |
| `pos` | `noun`, `verb`, `adjective`, `adverb`, ou `expression` pour une tournure complète (*fair enough*). |
| `ipa` | Britannique, style Oxford avec les points de syllabe. Obligatoire pour les mots et verbes à particule. |
| `theme` | La situation de la semaine, identique sur les 14 entrées. |
| `level` / `source` | Niveau CECR et liste d'origine (voir ci-dessus). |
| `cognate` | `none`, `partial` ou `false-friend`. |
| `trap` | Obligatoire pour un faux ami : une ligne **en anglais** qui nomme le mot français entre guillemets et dit quoi dire à la place. Sert aussi pour un piège de prononciation. C'est le seul endroit où un mot français a le droit d'apparaître. |
| `definition` | ≤ 20 mots, mots simples, un seul sens, point final. On **explique**, on ne donne pas un synonyme. |
| `examples` | Exactement 2. La première ≤ 12 mots, au présent, à la première ou deuxième personne : une phrase qu'on dirait demain. La deuxième montre un autre usage. Les deux contiennent le mot (ou une forme de `forms`). |
| `forms` | Toutes les formes fléchies utilisées dans les exemples (*figured out*, *workarounds*). Nécessaire pour la question à trou. |
| `collocations` | 2–3, ≤ 4 mots chacune ; la première apparaît telle quelle dans un exemple. |
| `synonyms` | 0–2, mots simples (A1–B1), jamais un mot-vedette du cours. De préférence aucun pour une tournure. |
| `mission` | Une ligne à l'impératif, ≤ 12 mots : quoi faire du mot aujourd'hui. |

## La procédure

1. Une branche, un fichier : tu ajoutes tes 14 entrées **à la fin** du tableau
   `words` (la liste est append-only — insérer au milieu décale le calendrier
   de tout le monde).
2. Tu vérifies :

   ```bash
   node scripts/validate-words.mjs
   node scripts/daily-telegram.mjs --dry-run --day <n>   # aperçu d'un jour
   ```

   Zéro erreur, et chaque avertissement soit corrigé, soit justifié dans la PR.
3. Une Pull Request titrée `Week N — <thème>`. Dans la description, un
   dialogue de 6–8 lignes entre deux collègues où les 14 mots apparaissent
   naturellement : si un mot a dû être forcé, il est mauvais.
4. Un collègue relit (idéalement celui qui écrira la semaine suivante — il
   relit les règles juste avant d'en avoir besoin), on merge, le site se
   redéploie seul.

Astuce pour la semaine suivante : dès qu'un collègue croise un mot utile dans
un mail ou une PR, il le poste dans le groupe Telegram avec 📌 et la phrase.
Ces mots-là ont déjà passé le test « un collègue le dirait ».

## Comment marche l'entraînement (pour comprendre les choix)

- **Première rencontre** : la fiche complète, puis une question tout de suite.
- **Cartes jeunes (niveaux 0–1)** : QCM, avec des leurres de même nature
  grammaticale tirés d'un *autre* thème, pour qu'un voisin de sens ne vienne
  jamais brouiller le premier souvenir.
- **Cartes mûres (niveau 2+)** : tu **tapes** le mot dans un trou de sa propre
  phrase d'exemple. Reconnaître un mot ne le met pas dans ta bouche en
  réunion ; le produire, si.
- **Intervalles** : 1, 3, 7, 14, 30, 60 puis 120 jours. Un échec fait
  redescendre de deux barreaux, pas à zéro : rater une fois une carte mûre,
  c'est du bruit, pas de l'amnésie.
- **Plafond** : 20 cartes par session. Le reste attend la session suivante —
  revenir d'une semaine de vacances ne doit pas ressembler à un mur.

Le code est du HTML/CSS/JS natif, sans build ni dépendance. Garde-le comme ça :
la barrière d'entrée basse, c'est la fonctionnalité principale du projet.
