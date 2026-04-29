# Product Backlog - HumatiQ

Backlog extrait des diagrammes `tmp/Diagrammes/Code`, du diagramme use-case RH, du BPMN, des routes frontend/backend et des modules existants de l'application.

## Acteurs

| Acteur | Description |
|---|---|
| Candidat | Utilisateur qui cree son profil, recherche des offres, postule, passe des quiz et rejoint des entretiens. |
| Utilisateur RH | Admin RH, recruteur ou chef de departement qui gere offres, candidats, pipeline, evaluations, quiz et entretiens. |
| Super Admin | Administrateur plateforme qui gere les entreprises, les utilisateurs, les parametres et la securite globale. |
| Moteur IA | Services d'extraction CV, matching, scoring, generation de quiz, analyse quiz et analyse d'entretien. |
| Systeme Email | Service d'envoi des notifications, invitations, rappels et OTP. |
| Google Calendar | Integration externe pour synchroniser les entretiens et disponibilites. |

## Legende

Priorite: `M` Must have, `S` Should have, `C` Could have.  
Statut cible: `A developper`, `En cours/partiel`, `Existe a valider`.

## Backlog

| ID | Epic | User story | Priorite | Statut cible | Criteres d'acceptation |
|---|---|---|---|---|---|
| US-001 | Auth Candidat | En tant que candidat, je veux creer un compte afin d'acceder a mon espace personnel. | M | Existe a valider | Inscription via email; role candidat applique; redirection vers setup profil. |
| US-002 | Auth Candidat | En tant que candidat, je veux me connecter afin d'acceder a mon tableau de bord. | M | Existe a valider | Connexion email/mot de passe; session conservee; routes protegees accessibles. |
| US-003 | Auth Candidat | En tant que candidat, je veux m'authentifier via SSO afin de reduire la friction d'inscription. | S | En cours/partiel | URL OAuth generee; callback gere; profil cree ou retrouve. |
| US-004 | Auth Candidat | En tant que candidat, je veux verifier mon email afin de securiser mon compte. | M | Existe a valider | Code ou lien envoye; verification confirmee; acces autorise apres validation. |
| US-005 | Auth Candidat | En tant que candidat, je veux activer la 2FA par email ou TOTP afin de proteger mon compte. | S | Existe a valider | Setup TOTP/email; verification; desactivation possible. |
| US-006 | Auth Candidat | En tant que candidat, je veux reinitialiser mon mot de passe oublie afin de recuperer mon acces. | M | A developper | Demande de reset; email envoye; nouveau mot de passe accepte. |
| US-007 | Auth Candidat | En tant que candidat, je veux me deconnecter afin de fermer ma session. | M | Existe a valider | Token/session supprime; retour vers login; acces protege bloque. |
| US-008 | Profil Candidat | En tant que candidat, je veux renseigner mes informations de base afin de completer mon profil. | M | Existe a valider | Nom, prenom, titre, naissance, adresse et LinkedIn sauvegardes. |
| US-009 | Profil Candidat | En tant que candidat, je veux importer mon CV afin d'alimenter automatiquement mon profil. | M | Existe a valider | Upload PDF/image accepte; fichier stocke; erreur claire si format invalide. |
| US-010 | Profil Candidat | En tant que candidat, je veux que l'IA extraie les donnees de mon CV afin de gagner du temps. | M | Existe a valider | Experiences, formations, competences et langues proposees depuis le CV; corrections possibles. |
| US-011 | Profil Candidat | En tant que candidat, je veux gerer mes experiences avec preuves afin que les RH puissent les verifier. | M | Existe a valider | Ajout, modification, suppression; document joint; telechargement RH possible. |
| US-012 | Profil Candidat | En tant que candidat, je veux gerer mes formations avec certificats afin de prouver mon parcours. | M | Existe a valider | Diplomes sauvegardes; certificat joint; telechargement RH possible. |
| US-013 | Profil Candidat | En tant que candidat, je veux gerer mes competences et langues afin d'ameliorer mon matching. | M | Existe a valider | Competences et niveaux sauvegardes; visibles dans profil 360. |
| US-014 | Profil Candidat | En tant que candidat, je veux gerer mes certificats afin de valoriser mes qualifications. | S | Existe a valider | Certificats ajoutables; document joint; verification RH possible. |
| US-015 | Profil Candidat | En tant que candidat, je veux definir mes preferences d'emploi afin de recevoir des opportunites pertinentes. | S | Existe a valider | Type contrat, localisation, salaire, disponibilite et mobilite sauvegardes. |
| US-016 | Profil Candidat | En tant que candidat, je veux mettre a jour ma photo de profil afin de personnaliser mon espace. | C | Existe a valider | Upload image; recadrage si disponible; avatar affiche dans les vues. |
| US-017 | Profil Candidat | En tant que candidat, je veux modifier mon profil apres l'onboarding afin de maintenir mes donnees a jour. | M | Existe a valider | Page profil editable; sauvegarde persistante; validation des champs. |
| US-018 | Profil Candidat | En tant que candidat, je veux supprimer mon compte afin d'exercer mon droit de retrait. | S | A developper | Confirmation forte; donnees anonymisees ou supprimees; session fermee. |
| US-019 | Offres Candidat | En tant que candidat, je veux rechercher des offres afin de trouver des opportunites. | M | Existe a valider | Liste paginee; recherche/filtres; seules offres publiees visibles. |
| US-020 | Offres Candidat | En tant que candidat, je veux consulter le detail complet d'une offre afin de decider si je postule. | M | Existe a valider | Description, entreprise, lieu, contrat, competences et deadline visibles. |
| US-021 | Offres Candidat | En tant que candidat, je veux voir mon score de match IA sur une offre afin d'estimer ma pertinence. | M | Existe a valider | Score affiche; justification ou facteurs disponibles; erreur geree si IA indisponible. |
| US-022 | Offres Candidat | En tant que candidat, je veux sauvegarder une offre afin d'y revenir plus tard. | S | Existe a valider | Sauvegarde/unsave; liste persistante; etat visible dans le detail. |
| US-023 | Candidature | En tant que candidat, je veux postuler a une offre afin d'entrer dans le processus de recrutement. | M | Existe a valider | Candidature creee une seule fois par offre; CV associe; notification RH declenchee. |
| US-024 | Candidature | En tant que candidat, je veux ajouter une lettre de motivation afin de contextualiser ma candidature. | S | Existe a valider | Lettre optionnelle sauvegardee; visible cote RH. |
| US-025 | Candidature | En tant que candidat, je veux suivre l'etat de mes candidatures afin de connaitre mon avancement. | M | Existe a valider | Liste des candidatures; statut, date, offre et entreprise visibles. |
| US-026 | Candidature | En tant que candidat, je veux consulter le detail d'une candidature afin de voir les prochaines etapes. | M | Existe a valider | Timeline, statut, quiz/entretien lies et informations offre visibles. |
| US-027 | Candidature | En tant que candidat, je veux retirer une candidature afin d'arreter le processus. | S | En cours/partiel | Action confirmee; statut retire ou suppression; RH notifie si necessaire. |
| US-028 | Analytics Candidat | En tant que candidat, je veux voir mes statistiques personnelles afin de suivre ma progression. | S | Existe a valider | KPI candidatures, vues profil, taux de retour et progression affiches. |
| US-029 | Analytics Candidat | En tant que candidat, je veux voir les ecarts de competences afin d'orienter mon apprentissage. | C | Existe a valider | Analyse skill gap affichee; recommandations exploitables. |
| US-030 | Analytics Candidat | En tant que candidat, je veux consulter les tendances marche afin d'adapter ma recherche. | C | En cours/partiel | Page tendances accessible; donnees ou fallback clairement presentees. |
| US-031 | Auth RH | En tant qu'utilisateur RH, je veux me connecter au dashboard afin de gerer les recrutements. | M | Existe a valider | Login RH; role admin/recruiter/chef accepte; redirection dashboard. |
| US-032 | Auth RH | En tant qu'utilisateur RH, je veux verifier mon email et utiliser l'OTP afin de securiser mon acces. | M | Existe a valider | Verification email; OTP valide; erreurs de code gerees. |
| US-033 | Auth RH | En tant qu'utilisateur RH, je veux reinitialiser mon mot de passe afin de recuperer mon compte. | M | Existe a valider | Workflow reset accessible; nouveau mot de passe applique. |
| US-034 | Profil RH | En tant qu'utilisateur RH, je veux configurer mon profil personnel afin d'identifier mes actions. | M | Existe a valider | Informations profil sauvegardees; avatar possible; role affiche. |
| US-035 | Entreprise RH | En tant qu'admin RH, je veux creer/configurer le profil entreprise afin de publier des offres sous ma marque. | M | Existe a valider | Nom, description, domaine, taille, adresse et logo sauvegardes. |
| US-036 | Entreprise RH | En tant qu'admin RH, je veux configurer l'integration de marque afin d'avoir une experience entreprise coherente. | S | En cours/partiel | Logo affiche; informations entreprise reprises sur les offres. |
| US-037 | Parametrage RH | En tant qu'admin RH, je veux gerer les parametres IA afin de controler le scoring et l'automatisation. | M | Existe a valider | Parametres top X/Y/Z, quiz par defaut et activation IA modifiables. |
| US-038 | Parametrage RH | En tant qu'utilisateur RH, je veux gerer mes preferences de notification afin de recevoir les alertes utiles. | S | En cours/partiel | Preferences sauvegardees; notifications respectent les choix. |
| US-039 | Departements | En tant qu'utilisateur RH, je veux creer des departements afin de structurer les offres. | M | Existe a valider | Creation avec nom et informations; departement liste. |
| US-040 | Departements | En tant qu'utilisateur RH, je veux modifier ou supprimer un departement afin de maintenir l'organisation. | S | Existe a valider | Edition persistante; suppression controlee si offres liees. |
| US-041 | Offres RH | En tant qu'utilisateur RH, je veux creer une offre afin d'ouvrir un recrutement. | M | Existe a valider | Champs obligatoires valides; offre sauvegardee; departement associe. |
| US-042 | Offres RH | En tant qu'utilisateur RH, je veux configurer l'automatisation IA d'une offre afin de preselectionner les candidats. | M | Existe a valider | Top X/Y/Z valides; etape quiz optionnelle; poids quiz total = 100%. |
| US-043 | Offres RH | En tant qu'utilisateur RH, je veux publier une offre afin de la rendre visible aux candidats. | M | Existe a valider | Statut publie; visible cote candidat; deadline appliquee. |
| US-044 | Offres RH | En tant qu'utilisateur RH, je veux lister et filtrer mes offres afin de piloter mes recrutements. | M | Existe a valider | Liste par entreprise/departement/statut; compte candidatures visible. |
| US-045 | Offres RH | En tant qu'utilisateur RH, je veux consulter les statistiques d'une offre afin d'evaluer sa performance. | S | Existe a valider | Nombre candidats, score moyen, progression pipeline affiches. |
| US-046 | Offres RH | En tant qu'utilisateur RH, je veux modifier une offre afin de corriger ou completer ses informations. | M | Existe a valider | Edition controlee; modifications visibles cote candidat. |
| US-047 | Offres RH | En tant qu'utilisateur RH, je veux cloturer/archiver une offre afin d'arreter les candidatures. | M | En cours/partiel | Statut archive/closed; offre non postulable; historique conserve. |
| US-048 | Offres RH | En tant qu'utilisateur RH, je veux gerer les collaborateurs d'une offre afin de travailler en equipe. | C | A developper | Ajout/retrait collaborateurs; droits respectes; actions tracees. |
| US-049 | Pipeline RH | En tant qu'utilisateur RH, je veux voir les candidatures d'une offre afin de traiter le pipeline. | M | Existe a valider | Kanban ou liste; candidatures chargees par offre; statut visible. |
| US-050 | Pipeline RH | En tant qu'utilisateur RH, je veux changer le statut d'une candidature afin de faire avancer le processus. | M | Existe a valider | Statut mis a jour; candidat notifie; historique conserve. |
| US-051 | Pipeline RH | En tant qu'utilisateur RH, je veux filtrer les candidatures par statut afin de prioriser mon travail. | M | Existe a valider | Filtres appliques; compteur par statut visible. |
| US-052 | Pipeline RH | En tant qu'utilisateur RH, je veux consulter le profil 360 d'un candidat afin d'evaluer son adequation. | M | Existe a valider | Profil, CV, competences, experiences, formations et candidatures visibles. |
| US-053 | Pipeline RH | En tant qu'utilisateur RH, je veux telecharger le CV d'un candidat afin de l'analyser hors plateforme. | M | Existe a valider | Fichier telechargeable; droits controles. |
| US-054 | Pipeline RH | En tant qu'utilisateur RH, je veux voir un snapshot rapide d'une candidature afin de prendre une decision rapide. | S | Existe a valider | Resume candidat/offre/statut/score visible sans quitter la liste. |
| US-055 | Pipeline RH | En tant qu'utilisateur RH, je veux voir le score IA et sa justification afin d'expliquer le classement. | M | Existe a valider | Score et details IA disponibles; recalcul possible si necessaire. |
| US-056 | Pipeline RH | En tant qu'utilisateur RH, je veux supprimer une candidature afin de nettoyer les donnees invalides. | S | Existe a valider | Confirmation requise; suppression ou archivage; candidat non expose a un etat incoherent. |
| US-057 | Pipeline RH | En tant qu'utilisateur RH, je veux reinitialiser une candidature afin de relancer un workflow bloque. | S | Existe a valider | Statuts, quiz/entretien lies remis a l'etat attendu; action tracee. |
| US-058 | Evaluation RH | En tant qu'utilisateur RH, je veux attribuer une note a un candidat afin de partager mon avis. | S | Existe a valider | Note 1-5 sauvegardee par RH; modification possible. |
| US-059 | Evaluation RH | En tant qu'utilisateur RH, je veux voir la note moyenne multi-collaborateurs afin d'avoir une vision collective. | S | Existe a valider | Moyenne calculee; nombre de notes affiche; arrondi coherent. |
| US-060 | Evaluation RH | En tant qu'utilisateur RH, je veux verifier les experiences du candidat afin de fiabiliser le dossier. | S | Existe a valider | Statut verification; note/commentaire; preuve telechargeable. |
| US-061 | Evaluation RH | En tant qu'utilisateur RH, je veux verifier formations et certificats afin de valider les qualifications. | S | Existe a valider | Verification par categorie; document consultable; statut persistant. |
| US-062 | Quiz RH | En tant qu'utilisateur RH, je veux uploader un document de reference afin de generer des quiz pertinents. | M | Existe a valider | Document stocke; sections/statistiques disponibles; erreurs format gerees. |
| US-063 | Quiz RH | En tant qu'utilisateur RH, je veux generer un quiz IA mono-document afin d'evaluer un candidat. | M | Existe a valider | Nombre questions, duree et difficulte parametres; questions generees. |
| US-064 | Quiz RH | En tant qu'utilisateur RH, je veux generer un quiz multi-documents afin de couvrir plusieurs themes. | S | Existe a valider | Plusieurs documents selectionnes; quiz coherent genere. |
| US-065 | Quiz RH | En tant qu'utilisateur RH, je veux previsualiser et modifier les questions afin de controler la qualite du quiz. | M | Existe a valider | Questions editables; ajout/suppression; sauvegarde des modifications. |
| US-066 | Quiz RH | En tant qu'utilisateur RH, je veux publier/envoyer un quiz au candidat afin de lancer l'evaluation. | M | Existe a valider | Quiz lie a candidature; email ou notification envoye; statut publie. |
| US-067 | Quiz RH | En tant qu'utilisateur RH, je veux suivre le statut des quiz envoyes afin de relancer si besoin. | S | Existe a valider | Statuts brouillon/publie/demarre/soumis/expire visibles. |
| US-068 | Quiz RH | En tant qu'utilisateur RH, je veux consulter le score et les reponses detaillees afin d'evaluer le resultat. | M | Existe a valider | Score final, bonnes/mauvaises reponses et analyse IA visibles. |
| US-069 | Quiz RH | En tant qu'utilisateur RH, je veux archiver un quiz afin de retirer les tests obsoletes. | C | Existe a valider | Statut archive; quiz non envoye; historique conserve. |
| US-070 | Quiz Candidat | En tant que candidat, je veux voir les quiz a passer afin de ne rater aucune evaluation. | M | Existe a valider | Quiz disponible depuis lien/page; deadline et duree affichees. |
| US-071 | Quiz Candidat | En tant que candidat, je veux demarrer un quiz chronometre afin de passer le test dans les conditions prevues. | M | Existe a valider | Timer lance; une seule tentative active; progression visible. |
| US-072 | Quiz Candidat | En tant que candidat, je veux soumettre mes reponses avant la fin du temps afin d'etre evalue. | M | Existe a valider | Soumission sauvegardee; correction declenchee; statut soumis. |
| US-073 | Quiz Candidat | En tant que candidat, je veux voir mon score si le RH l'autorise afin de connaitre mon resultat. | S | En cours/partiel | Score affiche selon parametre; masque sinon. |
| US-074 | Quiz Candidat | En tant que candidat, je veux telecharger une attestation de reussite afin de conserver une preuve. | C | A developper | Attestation PDF generee si seuil atteint; telechargement disponible. |
| US-075 | Entretiens RH | En tant qu'utilisateur RH, je veux proposer des creneaux d'entretien afin de laisser le candidat choisir. | M | Existe a valider | Plusieurs creneaux crees; conflits detectes; invitation envoyee. |
| US-076 | Entretiens RH | En tant qu'utilisateur RH, je veux creer directement un entretien afin de planifier un rendez-vous confirme. | M | Existe a valider | Entretien cree; candidat et offre lies; lien video disponible. |
| US-077 | Entretiens RH | En tant qu'utilisateur RH, je veux voir mon agenda d'entretiens afin d'organiser ma journee. | M | Existe a valider | Calendrier/liste; filtres par date; details entretien accessibles. |
| US-078 | Entretiens RH | En tant qu'utilisateur RH, je veux modifier ou annuler un entretien afin de gerer les changements. | M | Existe a valider | Mise a jour ou annulation persistante; notification candidat envoyee. |
| US-079 | Entretiens RH | En tant qu'utilisateur RH, je veux synchroniser les entretiens avec Google Calendar afin d'eviter les doubles reservations. | S | Existe a valider | OAuth Google; events recuperes; creation/sync des evenements. |
| US-080 | Entretiens RH | En tant qu'utilisateur RH, je veux demarrer et terminer une session video afin de conduire l'entretien en ligne. | M | Existe a valider | Session WebRTC lancee; etat start/end sauvegarde; acces candidat/RH controle. |
| US-081 | Entretiens RH | En tant qu'utilisateur RH, je veux capturer la transcription afin de conserver les points importants. | S | Existe a valider | Transcript envoye/sauvegarde; visible dans rapport. |
| US-082 | Entretiens RH | En tant qu'utilisateur RH, je veux analyser les emotions en temps reel afin d'enrichir l'evaluation. | C | En cours/partiel | Analyse affichee pendant live; donnees non bloquantes si modele indisponible. |
| US-083 | Entretiens RH | En tant qu'utilisateur RH, je veux generer un rapport IA post-entretien afin de resumer la session. | S | Existe a valider | Analyse/synthese generee; rapport consultable; reinitialisation possible. |
| US-084 | Entretiens RH | En tant qu'utilisateur RH, je veux voir l'historique des entretiens d'un candidat afin de comprendre le parcours. | S | Existe a valider | Liste par candidat/application; statut et rapport visibles. |
| US-085 | Entretiens Candidat | En tant que candidat, je veux voir mes entretiens planifies afin de preparer mes rendez-vous. | M | Existe a valider | Liste des entretiens; date, offre et lien visibles. |
| US-086 | Entretiens Candidat | En tant que candidat, je veux choisir/confirmer un creneau propose afin de fixer l'entretien. | M | Existe a valider | Selection d'un creneau; confirmation persistante; RH notifie. |
| US-087 | Entretiens Candidat | En tant que candidat, je veux demander un changement d'heure afin de reprogrammer si je suis indisponible. | S | A developper | Demande envoyee; RH peut repondre; statut de demande visible. |
| US-088 | Entretiens Candidat | En tant que candidat, je veux rejoindre l'entretien en ligne afin de passer l'echange a distance. | M | Existe a valider | Acces par lien; verification entretien actif; camera/micro geres. |
| US-089 | Notifications | En tant qu'utilisateur RH, je veux recevoir une alerte de nouvelle candidature afin d'agir rapidement. | M | Existe a valider | Notification in-app creee; compteur non lu mis a jour; email optionnel. |
| US-090 | Notifications | En tant qu'utilisateur RH, je veux recevoir des rappels d'entretien afin d'eviter les oublis. | S | Existe a valider | Rappels planifies; email/in-app 24h/1h selon regles. |
| US-091 | Notifications | En tant qu'utilisateur, je veux consulter mon centre de notifications afin de suivre les evenements. | M | Existe a valider | Liste triee; details; pagination ou limite coherente. |
| US-092 | Notifications | En tant qu'utilisateur, je veux marquer une notification comme lue ou tout lire afin de nettoyer mon compteur. | M | Existe a valider | Lecture individuelle et globale; compteur actualise. |
| US-093 | Notifications | En tant que candidat, je veux recevoir une alerte de changement de statut afin de suivre ma candidature. | M | Existe a valider | Notification in-app/email; message contient offre et nouveau statut. |
| US-094 | Notifications | En tant que candidat, je veux recevoir les invitations quiz/entretien par email afin de ne rien manquer. | M | Existe a valider | Email envoye avec lien; fallback in-app; metadata correcte. |
| US-095 | Notifications | En tant que candidat, je veux supprimer mes notifications afin de garder une liste propre. | C | Existe a valider | Suppression confirmee; notification retiree de la liste. |
| US-096 | Analytics RH | En tant qu'utilisateur RH, je veux voir les KPI globaux de recrutement afin de piloter l'activite. | M | Existe a valider | Jobs, candidats, candidatures, entretiens et tendances affiches. |
| US-097 | Analytics RH | En tant qu'utilisateur RH, je veux suivre le taux de conversion afin d'identifier les blocages du pipeline. | S | En cours/partiel | Funnel par etape; taux calcule; periode configurable si possible. |
| US-098 | Analytics RH | En tant qu'utilisateur RH, je veux voir la repartition par departement afin d'equilibrer les ressources. | S | Existe a valider | Graphique/table par departement; volumes coherents. |
| US-099 | Analytics RH | En tant qu'utilisateur RH, je veux suivre la tendance sur 30 jours afin de mesurer l'evolution. | S | Existe a valider | Serie temporelle; periode 30 jours; etats vides geres. |
| US-100 | Analytics RH | En tant qu'utilisateur RH, je veux consulter le score IA moyen et les meilleurs profils afin de prioriser les candidats. | S | Existe a valider | Score moyen et top profils visibles; seuil documente. |
| US-101 | Analytics RH | En tant qu'utilisateur RH, je veux telecharger des rapports BI afin de les partager. | C | A developper | Export CSV/PDF; filtres appliques; fichier nomme clairement. |
| US-102 | Super Admin | En tant que super admin, je veux visualiser un dashboard plateforme afin de suivre l'activite globale. | M | Existe a valider | KPI entreprises, utilisateurs, offres et alertes affiches. |
| US-103 | Super Admin | En tant que super admin, je veux lister et rechercher les entreprises afin d'administrer les clients. | M | Existe a valider | Recherche, filtres, pagination; compte users/jobs visible. |
| US-104 | Super Admin | En tant que super admin, je veux creer une entreprise afin d'onboarder un client. | M | Existe a valider | Formulaire valide; entreprise creee; statut et plan definis. |
| US-105 | Super Admin | En tant que super admin, je veux modifier ou supprimer une entreprise afin de maintenir la base clients. | M | Existe a valider | Edition/suppression avec confirmation; impacts visibles. |
| US-106 | Super Admin | En tant que super admin, je veux gerer les utilisateurs afin de controler les acces plateforme. | M | Existe a valider | Liste, recherche, creation/edition/suppression; role et entreprise assignes. |
| US-107 | Super Admin | En tant que super admin, je veux configurer la MFA afin de securiser l'administration. | M | Existe a valider | Verification code; erreurs gerees; acces conditionne. |
| US-108 | Super Admin | En tant que super admin, je veux gerer les parametres generaux afin d'adapter le comportement plateforme. | S | Existe a valider | Parametres sauvegardes; validation; theme/preference persistants. |
| US-109 | Systeme IA | En tant que systeme, je veux vectoriser les candidats afin d'accelerer le matching. | M | Existe a valider | Embeddings crees; scripts de backfill disponibles; erreurs journalisees. |
| US-110 | Systeme IA | En tant que systeme, je veux executer automatiquement le pipeline d'une offre afin de preselectionner les meilleurs candidats. | M | Existe a valider | Trigger deadline; filtre vectoriel; scoring IA; quiz optionnel; resultats sauvegardes. |
| US-111 | Systeme | En tant que systeme, je veux fermer les offres expirees afin de respecter les deadlines. | S | Existe a valider | Scheduler actif; offres expirees mises a jour; logs disponibles. |
| US-112 | Systeme | En tant que systeme, je veux envoyer des rappels d'entretien planifies afin de soutenir les utilisateurs. | S | Existe a valider | Scheduler actif; rappels selon delais; doublons evites. |
| US-113 | Systeme | En tant que systeme, je veux exposer les fichiers statiques securises afin de servir CV, logos et avatars. | M | Existe a valider | URLs fonctionnelles; controles d'acces sur endpoints sensibles; fichiers stockes proprement. |
| US-114 | Qualite | En tant qu'equipe produit, je veux des tests automatises sur les flux critiques afin de reduire les regressions. | M | En cours/partiel | Tests saved jobs, quiz, automation, CV parser et setup passent; nouveaux tests ajoutes pour gaps majeurs. |

## Decoupage MVP suggere

| Release | Objectif | User stories |
|---|---|---|
| MVP 1 | Authentification, onboarding candidat, offres et candidatures de base. | US-001 a US-027, US-031 a US-036, US-039 a US-047, US-049 a US-055 |
| MVP 2 | IA de matching, parametrage, evaluations et quiz. | US-037, US-042, US-055, US-058 a US-074, US-109, US-110 |
| MVP 3 | Entretiens, notifications et analytics. | US-075 a US-101, US-111, US-112 |
| MVP 4 | Administration plateforme et durcissement qualite/securite. | US-102 a US-108, US-113, US-114 |

## Sources utilisees

| Source | Utilisation |
|---|---|
| `tmp/Diagrammes/Code/Module_1_Partie_Candidat.puml` | Authentification, profil et parametrage candidat. |
| `tmp/Diagrammes/Code/Module_1_Partie_RH.puml` | Authentification, profil entreprise et parametrage RH. |
| `tmp/Diagrammes/Code/Module_2_Offres.puml` | Gestion des offres et recherche candidat. |
| `tmp/Diagrammes/Code/Module_3_Pipeline.puml` | Pipeline de candidatures cote candidat et RH. |
| `tmp/Diagrammes/Code/Module_4_Evaluation.puml` | Notation et verification des qualifications. |
| `tmp/Diagrammes/Code/Module_5_Quiz.puml` | Generation, publication, passage et correction des quiz. |
| `tmp/Diagrammes/Code/Module_6_Entretiens.puml` | Planification, conduite et confirmation des entretiens. |
| `tmp/Diagrammes/Code/Module_7_Notifications.puml` | Notifications in-app/email et historique. |
| `tmp/Diagrammes/Code/Module_8_Analytics.puml` | Dashboards et indicateurs RH/candidat. |
| `HR_UseCase_Diagram.md` | Details RH supplementaires: WebRTC, transcription, emotion, Google Calendar, rapports IA. |
| `frontend/src/core/routesCandidat.jsx` | Ecrans candidat reels: setup, dashboard, jobs, applications, quiz, interviews. |
| `frontend/src/core/routesHr.jsx` | Ecrans RH reels: dashboard, calendrier, offres, departements, applications, quiz, live interview. |
| `frontend/src/core/routesSuperAdmin.jsx` | Ecrans super admin: dashboard, companies, users, settings, MFA. |
| `backend/routers/*` et `backend/routes/candidat/*` | Capacites API existantes et flux backend. |
