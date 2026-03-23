# Processus de Recrutement (BPMN HR) - Plateforme HumatiQ

Ce document détaille toutes les informations nécessaires pour modéliser le processus métier (BPMN) de la gestion des candidatures côté Ressources Humaines (RH).

## 1. Réception de la Candidature (Événement déclencheur)
**Étape 1 : Soumission (Candidat)**
- Le candidat soumet sa candidature pour une offre d'emploi.
- **Action système automatique :** 
  - Sauvegarde du dossier candidat (CV, profil, lettre de motivation).
  - Création du `profile_snapshot` (capture des compétences, expériences, éducation).
  - L'état de la candidature passe à **"Nouveau"** (`pending`).

**Étape 2 : Pré-analyse par Intelligence Artificielle (Système)**
- **Action système automatique :**
  - Traitement des données via la base vectorielle.
  - Génération d'un **Score IA** (0 à 100%) basé sur l'adéquation profil/offre.
  - Génération d'une **Justification IA** (analyse textuelle des points forts).

---

## 2. Phase de Sélection et Revue (RH)
**Étape 3 : Tri et Filtrage (RH)**
- Le recruteur accède au tableau de bord de l'offre.
- Il consulte la liste des candidatures triées par *Score IA* ou la section *Top Suggestions IA*.

**Étape 4 : Évaluation Manuelle (RH)**
- Le recruteur ouvre le dossier `Suivi Candidat` (qui affiche le profil, les compétences, le score IA, le résumé IA, et le pipeline de progression).
- **Passerelle logique (Décision RH) :**
  - 👉 **Option A :** Le profil ne correspond pas ➡️ Rejet (Notification au candidat, fin du processus pour cette candidature).
  - 👉 **Option B :** Le profil est intéressant ➡️ Passage à l'état **"En revue"** (`review`).

---

## 3. Évaluation Technique / Quiz
**Étape 5 : Assignation d'un Test (RH)**
- Le recruteur fait passer le candidat à l'état **"Test technique"** (`test`).
- **Action système automatique :** Envoi d'une invitation au candidat (email/notification) contenant un lien vers un Quiz (ou Test).

**Étape 6 : Passage du Test (Candidat)**
- Le candidat reçoit la notification et passe le test technique dans le temps imparti.
- **Action système automatique :** Calcul du score du test et mise à jour du dossier de candidature.

**Étape 7 : Revue des Résultats du Test (RH)**
- Le recruteur consulte les résultats du test technique soumis.
- **Passerelle logique (Décision RH) :**
  - 👉 **Option A :** Test échoué ➡️ Rejet de la candidature (Fin).
  - 👉 **Option B :** Test réussi ➡️ Passage à l'étape "Entretien".

---

## 4. Phase d'Entretiens (Itérative)
Cette phase est une **boucle (loop)** qui peut se répéter plusieurs fois (ex: Entretien RH, puis Entretien Managérial, puis Entretien Technique final).

**Étape 8 : Planification de l'Entretien (RH)**
- Le recruteur fait passer le candidat à l'état **"Entretien"** (`interview`).
- Le RH contacte le candidat pour fixer une date/heure.

**Étape 9 : Réalisation de l'Entretien (RH & Candidat)**
- Déroulement de l'entretien (via Face-Affectus / Google Meet intégré).
- Le recruteur remplit une grille d'évaluation ou rédige un compte-rendu post-entretien.

**Étape 10 : Évaluation Post-Entretien (RH)**
- Le recruteur annexe son avis au dossier du candidat.
- **Passerelle logique complexe (Décision Post-Entretien) :**
  - 👉 **Option A :** Avis défavorable ➡️ Rejet de la candidature (Fin).
  - 👉 **Option B :** Avis favorable, mais **nécessite un autre entretien** ➡️ *Retour à l'Étape 8* (Boucle : Planification d'un nouvel entretien avec un autre intervenant).
  - 👉 **Option C :** Avis favorable, **processus validé** ➡️ Passage à l'offre.

---

## 5. Phase Finale de Proposition (Clôture)
**Étape 11 : Envoi d'une Offre (RH)**
- Le recruteur fait passer l'état à **"Offre acceptée"** (`offered`).
- (Processus potentiellement externe : Négociation salariale, signature de contrat).

**Étape 12 : Conclusion (Système/RH)**
- Dès que le poste est pourvu avec ce candidat, cela peut potentiellement déclencher :
  - La fermeture de l'offre d'emploi sur la plateforme.
  - L'envoi automatique d'emails de refus personnalisés aux autres candidats en cours (s'ils n'ont pas encore été rejetés).
- **Fin du processus.**

---
### Résumé des États Techniques du Pipeline :
1. `pending` (Nouveau)
2. `review` (En revue)
3. `test` (Test technique)
4. `interview` (Entretien - Étape répétable 🔁)
5. `offered` (Offre acceptée)
6. `rejected` (Rejeté)
