# PolyPoly

Un Monopoly multijoueur en ligne à thème voyage, pensé pour être joué en soirée sur un LAN : chacun rejoint depuis son téléphone (en scannant un QR code), un PC ou une TV affiche le plateau partagé, et la partie ajoute plusieurs mécaniques maison (alliances, otages, météo, cartes "squat", système de santé) au-dessus des règles classiques du jeu.

Le plateau est un tour d'Europe : 8 pays (Portugal, Grèce, Norvège, Pays-Bas, Espagne, Italie, Royaume-Uni, France) remplacent les rues, avec aéroports, compagnies (utilities), hôpitaux, taxes et cases cartes.

## Fonctionnalités clés

- **Salon + lobby** : un salon unique par serveur, rejoint via QR code, avec configuration des règles par l'hôte avant de lancer la partie.
- **Écran plateau partagé** (`/board`) : affichage lecture-seule pour une TV/PC commun, séparé du contrôleur téléphone.
- **Panneau admin** (`/admin`) : reset de partie, exclusion de joueurs, et raccourcis de test (envoyer en prison, attribuer un pass squat).
- **Reconnexion automatique** : session persistée côté client (`localStorage`) et côté serveur (jeton de session) ; un joueur qui perd la connexion reprend sa place sans intervention.
- **Persistance de partie** : l'état est sauvegardé sur disque après chaque action, une partie en cours survit à un redémarrage du serveur/conteneur.
- **Négociation de trades** : offres à deux temps (composer → envoyer), possibilité de contre-offrir, une seule offre active à la fois par joueur (configurable).
- **Fiche de règles cherchable** : générée à partir des constantes du moteur (jamais désynchronisée du code), avec recherche en direct.
- **Mécaniques additionnelles activables** : alliances temporaires, otages depuis la prison, météo (jours de pluie/soleil), cartes "squat" (nuit gratuite), mode santé, enchères, hypothèques, construction équilibrée, offre limitée de maisons/hôtels.
- **Valeur nette (net worth)** affichée pour chaque joueur, utilisée pour départager la victoire en mode limite de tours/temps.

## Stack technique

- **Monorepo** npm workspaces, TypeScript strict (`tsconfig.base.json`), modules ESM partout.
- **Moteur de jeu** (`packages/engine`) : TypeScript pur, sans dépendance runtime, testé avec Vitest.
- **Serveur** (`apps/server`) : Node.js 22, Express 4, Socket.IO 4, exécuté directement via `tsx` (pas de compilation JS en sortie).
- **Client web** (`apps/web`) : React 19, Vite 6, Tailwind CSS 4, [motion](https://motion.dev) (animations), `socket.io-client`, `qrcode.react`, `lucide-react`.
- **Déploiement** : Docker multi-stage (`node:22-alpine`), `docker-compose`, volume nommé pour la persistance.

## Structure du monorepo

```
polypoly/
├── apps/
│   ├── server/            # Serveur Express + Socket.IO, salon unique, persistance JSON
│   │   └── src/
│   │       ├── index.ts       # Bootstrap HTTP/Socket.IO, handlers d'événements
│   │       ├── room.ts        # Classe Room : joueurs, config, cycle de vie de partie
│   │       └── persistence.ts # Snapshot JSON sur disque
│   └── web/                # Client React (téléphone, plateau partagé, admin)
│       └── src/
│           ├── components/    # Écrans (Join, Lobby, Controller, BoardDisplay, AdminPage...)
│           │   ├── board/     # Rendu du plateau (grille, tuiles, jetons, animations)
│           │   └── game/      # Panneaux de jeu (actions, trades, alliances, règles...)
│           └── hooks/         # useRoom, useSpectator, useAdmin, useKeyboardInset
├── packages/
│   ├── engine/              # Moteur de jeu pur (règles, état, actions, événements)
│   │   └── src/
│   │       ├── data/          # Plateau (board.europe.ts) et cartes (cards.ts)
│   │       ├── applyAction.ts # Reducer principal : action + état -> nouvel état + événements
│   │       ├── legalActions.ts# Actions légales pour un joueur à un instant donné
│   │       ├── rules.ts       # Constantes de règles, calcul des loyers, valeur nette
│   │       └── *.test.ts      # 20 fichiers de tests (Vitest)
│   └── shared/               # Types partagés client/serveur : config, room, événements socket
├── design/                  # Maquette HTML de référence pour le design du plateau
├── capture_decran/          # Captures d'écran de référence (tuiles, cartes, trades...)
├── docker-compose.yml
├── Dockerfile
└── DEPLOY.md                # Guide de déploiement sur Raspberry Pi
```

## Prérequis

- Node.js 22+
- npm (workspaces)

## Installation

```sh
git clone https://github.com/RomainBouchez/PolyPoly.git polypoly
cd polypoly
npm install
```

## Lancement en développement

Deux processus séparés (serveur et client Vite), à lancer dans deux terminaux :

```sh
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:5173 (proxy socket vers le serveur)
```

Le serveur écoute sur `0.0.0.0` et affiche au démarrage l'URL LAN à utiliser depuis un téléphone. En dev, ouvrez `/board` pour l'écran partagé et `/admin` pour le panneau admin.

## Scripts npm

Depuis la racine :

| Script | Effet |
|---|---|
| `npm run dev:server` | Démarre le serveur en mode watch (`tsx watch`) |
| `npm run dev:web` | Démarre le client Vite en mode dev |
| `npm test` | Lance la suite de tests du moteur (`vitest run`, dans `packages/engine`) |
| `npm run build` | Build dans l'ordre : `shared` → `engine` → `web` → `server` (type-check `tsc --noEmit` pour les packages TS, build Vite pour le web) |

Chaque workspace expose aussi ses propres scripts (`npm run build --workspace=apps/web`, etc.).

## Déploiement

Le projet est conçu pour tourner en conteneur unique (serveur + client statique servi par le même process Express) :

```sh
docker compose up -d --build
```

Le conteneur écoute en interne sur le port 4000, exposé côté hôte sur le port **3018** (voir `docker-compose.yml`). L'état de la partie est persisté dans un volume nommé `polypoly-data` (`/data/room.snapshot.json`), donc une partie en cours survit à `docker compose up -d --build` ou à un redémarrage du conteneur.

Le guide complet (ciblé Raspberry Pi 5 / arm64, avec `docker compose logs`, `down -v` pour repartir de zéro, etc.) est dans [`DEPLOY.md`](./DEPLOY.md).

## Documentation complète

Architecture détaillée, modèle de données, protocole réseau, règles du jeu telles qu'implémentées, mécaniques originales, cycle de vie d'une partie, frontend, persistance et limites connues : voir [`docs/DOCUMENTATION.md`](./docs/DOCUMENTATION.md).
