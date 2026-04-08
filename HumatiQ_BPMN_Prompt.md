# 📋 Prompt BPMN.io — Processus RH HumatiQ

## 🎯 Comment utiliser ce document

1. Ouvrir **[bpmn.io](https://bpmn.io)** ou **[demo.bpmn.io](https://demo.bpmn.io)**
2. **Option A (recommandée)** : Importer directement le fichier `HumatiQ_BPMN.bpmn` via `Fichier > Ouvrir`
3. **Option B** : Copier-coller le prompt ci-dessous dans l'IA de bpmn.io ou dans **[bpmn.new](https://bpmn.new)** avec l'assistant IA

---

## 🤖 PROMPT COMPLET POUR L'IA bpmn.io

> **Copiez tout ce bloc et collez-le dans l'assistant IA de bpmn.io**

---

```
Crée un diagramme BPMN 2.0 complet pour le processus de recrutement de la plateforme HumatiQ (plateforme RH intelligente basée sur l'IA).

## CONFIGURATION GÉNÉRALE
- Un seul Pool nommé : "Processus de Recrutement — HumatiQ"
- 3 Swim Lanes horizontales :
  1. "RH / Recruteur" (Admin · ARH · Chef Département)
  2. "Candidat"
  3. "Système IA · Email · Google Calendar"
- Direction : de gauche à droite
- Style : professionnel, bien espacé, lisible

---

## PHASE 1 — GESTION DES OFFRES D'EMPLOI [Lane: RH]

START EVENT (cercle simple) : "Besoin de recrutement identifié"

→ USER TASK : "Créer l'offre d'emploi"
  Note : titre, compétences, département, type contrat, salaire, localisation

→ USER TASK : "Publier l'offre sur la plateforme HumatiQ"
  Note : L'offre devient visible aux candidats

---

## PHASE 2 — CANDIDATURE [Lane: Candidat]

(connexion depuis "Publier l'offre" vers la lane Candidat)

→ USER TASK [Candidat] : "Consulter les offres disponibles"
→ USER TASK [Candidat] : "Postuler (CV + lettre de motivation)"
  Note : upload CV, lettre de motivation, snapshot profil automatique

→ INTERMEDIATE CATCH EVENT (message) [Lane: RH] : "Candidature reçue"
  Note : notification automatique envoyée à l'équipe RH

---

## PHASE 3 — TRAITEMENT DE LA CANDIDATURE [Lane: IA puis RH]

→ SERVICE TASK [IA] : "Parser CV & calculer score IA (0-100)"
  Note : extraction compétences, score de pertinence, justification textuelle (AI Matching Engine)

→ USER TASK [RH] : "Consulter candidature + score IA + profil 360°"
  Note : score, justification, CV, qualifications vérifiées, historique

→ EXCLUSIVE GATEWAY [RH] : "Candidature pertinente ?"

  Branche NON → TASK [RH] : "Notifier refus (phase 1)"
             → END EVENT (terminate) : "Candidature refusée"

  Branche OUI → continuer vers Phase 4

---

## PHASE 4 — GÉNÉRATION ET PASSAGE DU QUIZ IA

→ SERVICE TASK [IA] : "Générer quiz IA depuis documents RH"
  Note : QCM + Vrai/Faux, calibration difficulté, basé sur documents uploadés (PDF, DOCX, PPTX)

→ USER TASK [RH] : "Éditer, valider et configurer le quiz"
  Note : modifier/ajouter questions, configurer timer (en minutes)

→ SEND TASK [RH] : "Publier le quiz au candidat"
  Note : statut = 'published', lié à la candidature

→ SERVICE TASK [IA] : "Email + notification in-app — Quiz disponible"
  Note : email automatique avec lien, durée, instructions

→ USER TASK [Candidat] : "Passer le quiz en ligne (avec timer auto)"
  Note : QCM + V/F, timer décompte, soumission automatique à expiration

→ SERVICE TASK [IA] : "Analyser résultats quiz (IA) + calcul score"
  Note : score, lacunes identifiées, rapport analyse

→ USER TASK [RH] : "Consulter résultats et analyse IA du quiz"

→ EXCLUSIVE GATEWAY [RH] : "Candidat qualifié après quiz ?"

  Branche NON → TASK : "Notifier refus après quiz"
             → END EVENT (terminate) : "Refusé après quiz"

  Branche OUI → continuer vers Phase 5

---

## PHASE 5 — PLANIFICATION DE L'ENTRETIEN

→ USER TASK [RH] : "Proposer des créneaux d'entretien"
  Note : vérification anti-doublon automatique, type entretien (vidéo/présentiel), message personnalisé

→ SERVICE TASK [IA] : "Email invitation candidat avec créneaux"
  Note : liste créneaux disponibles, type entretien, lien de confirmation

→ USER TASK [Candidat] : "Choisir un créneau d'entretien"
  Note : le candidat sélectionne depuis son espace portail

→ INTERMEDIATE CATCH EVENT (message) [RH] : "Créneau confirmé par le candidat"

→ USER TASK [RH] : "Créer l'entretien dans le système"
  Note : date/heure, type, durée, salle WebRTC générée automatiquement

→ SERVICE TASK [IA] : "Synchroniser Google Calendar"
  Note : OAuth2, événement créé dans le calendrier RH

→ SERVICE TASK [IA] : "Email confirmation aux deux parties"
  Note : récapitulatif entretien, rappels planifiés (24h et 1h avant)

→ INTERMEDIATE TIMER EVENT [RH] : "Attendre la date de l'entretien"

---

## PHASE 6 — CONDUITE DE L'ENTRETIEN (VIDÉO + IA EN TEMPS RÉEL)

(Deux flux parallèles démarrent ici)

Flux RH :
→ USER TASK [RH] : "Conduire l'entretien vidéo WebRTC"
  Note : connexion peer-to-peer, chat, transcription Speech-to-Text

Flux Candidat :
→ USER TASK [Candidat] : "Rejoindre l'entretien vidéo"
  Note : accès depuis espace candidat, connexion WebRTC automatique

(Les deux flux convergent vers :)
→ SERVICE TASK [IA] : "Analyser émotions en temps réel (FER model)"
  Note : analyse expressions faciales frame par frame, stockage avec timestamps (joie, stress, confiance, etc.)

→ SERVICE TASK [IA] : "Générer rapport IA post-entretien (complet)"
  Note : transcription analysée, courbe émotions, points forts/faibles, score global, recommandations

---

## PHASE 7 — DÉCISION FINALE

→ USER TASK [RH] : "Consulter rapport IA de l'entretien (360°)"
  Note : rapport complet, possibilité de noter manuellement 1-5 étoiles, vérifier qualifications

→ EXCLUSIVE GATEWAY [RH] : "Décision finale ?"

  Branche EMBAUCHÉ :
  → TASK [RH] : "Préparer et envoyer l'offre d'emploi"
  → SERVICE TASK [IA] : "Email offre + notification in-app"
  → END EVENT : "✅ Candidat embauché"

  Branche REFUSÉ :
  → TASK [RH] : "Envoyer refus final et archiver candidature"
  → SERVICE TASK [IA] : "Email refus final + notification"
  → END EVENT (terminate) : "❌ Candidat refusé"

---

## CONVENTIONS DE COULEURS (optionnel)
- Lane RH : fond bleu clair (#EBF8FF)
- Lane Candidat : fond vert clair (#F0FFF4)
- Lane IA/Systèmes : fond gris clair (#F7FAFC)
- Gateways décisionnelles : couleur orange/ambre
- Service Tasks IA : couleur violette
- End Events négatifs (refus) : couleur rouge
- End Event positif (embauché) : couleur verte

---

## ÉLÉMENTS BPMN UTILISÉS (récapitulatif)

| Élément | Quantité | Usage |
|---|---|---|
| Start Event | 1 | Démarrage du processus |
| User Task | 13 | Actions humaines (RH + Candidat) |
| Service Task | 9 | Actions automatiques (IA, Email, Cal) |
| Send Task | 1 | Publication quiz |
| Exclusive Gateway | 3 | Décisions (Pertinent? Qualifié? Embauché?) |
| Intermediate Catch (Message) | 2 | Réception candidature + confirmation créneau |
| Intermediate Timer | 1 | Attendre date d'entretien |
| End Event (Terminate) | 3 | Fins négatives (refus 1, 2, 3) |
| End Event Normal | 1 | Fin positive (embauché) |
| Swim Lanes | 3 | RH / Candidat / IA+Systèmes |

---

## PROCESSUS COMPLETS COUVERTS

### 1. Processus Gestion des Offres
- Création → Publication → Visibilité candidats

### 2. Processus Pipeline de Candidatures
- Postulation → Score IA → Revue RH → Décision acceptation

### 3. Processus Quiz IA
- Génération IA → Édition RH → Publication → Passage → Analyse → Décision

### 4. Processus Planification Entretien
- Créneaux → Invitation candidat → Confirmation → Création → Google Calendar

### 5. Processus Conduite Entretien
- Session WebRTC bidirectionnelle → Analyse IA temps réel → Rapport post-entretien

### 6. Processus Décision Finale
- Rapport 360° → Décision → Offre ou Refus → Archivage

---

## INTÉGRATIONS SYSTÈMES EXTERNES REPRÉSENTÉES

| Système | Rôle dans le BPMN |
|---|---|
| **IA Engine (FER + NLP)** | Scoring CV, Génération quiz, Analyse émotions, Rapport |
| **Email System (SMTP)** | Notifications candidature, quiz, créneaux, confirmation, résultat |
| **Google Calendar API** | Sync entretien → événement dans agenda RH |
| **WebRTC / WebSocket** | Session vidéo peer-to-peer entre recruteur et candidat |

---

## NOTES TECHNIQUES IMPORTANTES

- Les **Service Tasks** représentent des appels automatiques aux APIs backend FastAPI
- Les **Intermediate Catch Events (Message)** représentent l'attente d'actions candidat
- Le **Timer Event** représente l'attente jusqu'à la datetime de l'entretien planifié
- Les **3 End Events terminate** sont distincts (refus après CV, après quiz, après entretien)
- Le **flux parallèle** en Phase 6 représente la connexion simultanée Recruteur + Candidat

```

---

## 📥 Import Direct dans bpmn.io

Si vous avez le fichier `HumatiQ_BPMN.bpmn` :

1. Aller sur **[demo.bpmn.io](https://demo.bpmn.io)**
2. Cliquer sur l'icône **dossier** (Ouvrir fichier)
3. Sélectionner `HumatiQ_BPMN.bpmn`
4. Le diagramme s'affiche immédiatement
5. Utiliser le bouton **"Auto-Layout"** si besoin de réorganiser

---

## 🔧 Outils recommandés pour BPMN

| Outil | URL | Avantage |
|---|---|---|
| **bpmn.io** | demo.bpmn.io | Import XML direct, gratuit |
| **Camunda Modeler** | camunda.com/download/modeler | Desktop, fonctionnalités avancées |
| **Bizagi Modeler** | bizagi.com | Très complet, export PDF |
| **Lucidchart** | lucidchart.com | Collaboration temps réel |
| **draw.io** | app.diagrams.net | Gratuit, import BPMN |
