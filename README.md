# CK3FR RP · La Chancellerie

Site web de la communauté **CK3FR RP** — roleplay *Crusader Kings III* francophone, univers
*A Game of Thrones*. Le cœur du site est **La Chancellerie**, la messagerie scellée entre les maisons.

- **Frontend** : React + Vite + TypeScript, direction artistique « Le Grimoire ».
- **Backend** : Supabase (Postgres, Auth, Storage, Realtime, RLS).
- **Hébergement** : Vercel (frontend) + Supabase managé.

> Projet de fan, non affilié à Paradox Interactive, HBO ou George R. R. Martin.

---

## Démarrage local

```bash
npm install
cp .env.example .env     # puis remplis les deux clés Supabase
npm run dev
```

Sans `.env` rempli, le site démarre quand même et affiche un message d'accueil
expliquant qu'il faut relier la base.

## Scripts

| Commande          | Effet                                          |
| ----------------- | ---------------------------------------------- |
| `npm run dev`     | Serveur de développement Vite                  |
| `npm run build`   | Vérifie les types puis construit la version prod |
| `npm run preview` | Sert le build de production en local           |
| `npm run lint`    | Vérification TypeScript seule                  |

---

## Déploiement (guidé)

### 1. Créer le projet Supabase
- [supabase.com](https://supabase.com) → **New project** (offre gratuite suffisante).
- Note l'**URL du projet** et la **clé `anon`** (Project Settings → API).

### 2. Lancer la migration SQL
- Ouvre **SQL Editor** dans Supabase.
- Colle le contenu de [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) et exécute.
- Cela crée les tables, la RLS, les triggers, le bucket Storage `corbeaux` et le Realtime.
- **Change les codes d'accès** : `update public.app_config set value = '...' where key = 'code_citadelle';`
- Auth → vérifie que **« Confirm email »** est activé (Authentication → Providers → Email).

### 3. Renseigner les clés
Dans `.env` :
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Déployer sur Vercel
- Pousse le dépôt sur GitHub, puis **Import** dans Vercel.
- Framework : **Vite**. Ajoute les deux variables `VITE_SUPABASE_*` dans les *Environment Variables*.
- Deploy.

### 5. (Optionnel) Nom de domaine
- Vercel → Settings → Domains.

---

## Structure

```
src/
  lib/         supabase.ts (client) · houses.ts (référentiel des maisons)
  context/     AuthContext.tsx (session + profil)
  components/  Layout · Seal · Lettrine · HousePicker · ComingSoon
  pages/       Gate · Chancellerie · Gazette · Destin · Admin · Static (légal)
  types/       database.ts (miroir des tables)
supabase/
  migrations/  0001_init.sql
```

## Modèle de données

`profiles`, `house_claims`, `ravens`, `raven_recipients`, `proclamations`,
`comments`, `graveyard`, `archives`, `reports` — détails et politiques RLS dans la migration.

> La colonne « personnage » s'appelle `character_name` (`character` est un mot réservé SQL).

## Avancement

- [x] **Étape 1** — Scaffold, DA « Le Grimoire », coquille & navigation, client Supabase, migrations SQL.
- [x] **Étape 2** — La Chancellerie :
  - [x] Envoi (personne / maison / royaume), image jointe, lecture parchemin, statut « lu », réponse.
  - [x] Temps réel (les lettres reçues arrivent en direct).
  - [x] Fils de discussion (vue conversation), recherche, archivage personnel.
- [~] **Étape 3** — Les Salons (miroir du Discord) :
  - [x] Navigation barre latérale (Corbeaux · Décrets · Le Royaume · La Cour).
  - [x] Modèle `posts`/`post_comments`, rôle Roi, RLS par salon, temps réel (migration 0003).
  - [x] Salons : décret-royal (rois), décret-noble (vassaux), 8 régions, rumeurs, lore (admins).
  - [x] Publier, commenter, supprimer, image jointe ; droits selon le rôle.
  - [ ] Signalement + file de modération (avec Étape 5).
- [~] **Étape 5** — La Citadelle (admin & modération, migration 0005) :
  - [x] Gestion des mestres : sacrer/destituer Roi, nommer/retirer Mestre, observateur, bannir.
  - [x] Signalement (posts & commentaires) + file de modération (voir, supprimer, classer).
  - [x] Hiérarchie Grand Mestre (fondateur) › Mestre › Roi/Vassal/Observateur.
  - [x] Nettoyage par salon (corbeaux, lore, régions…) un à un ; réinitialisation totale réservée au Grand Mestre.
  - [x] Sécurité : is_king et is_founder protégés contre l'auto-attribution.
- [x] **Étape 4** — Mon destin :
  - [x] Mort du personnage → renaissance dans la **même maison** sous un nouveau prénom ; l'ancien rejoint le cimetière.
  - [x] Tes personnages tombés + nécrologie du royaume.
  - [x] Suppression de compte (RGPD, migration 0007).

### Extensions

- [x] Inscription sans code : rôles donnés uniquement depuis la Citadelle (migration 0008).
- [x] Annuaire : Armorial des maisons, La Cour (joueurs), fiches de personnage.
- [x] Éditer ses posts/commentaires + épingler les posts (migration 0009).
- [x] Pastilles de non-lus dans la barre latérale (migration 0010).
- [x] Pactes & Diplomatie : traités entre maisons + signatures (migration 0011).
- [x] Requêtes (tickets) : les joueurs soumettent une action, les Mestres valident/refusent (migration 0012).
- [x] Scrollbars stylées « Le Grimoire ».
- [ ] Déploiement Vercel (mise en ligne publique).
