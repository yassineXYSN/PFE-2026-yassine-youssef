# HumatiQ — Diagramme BPMN Général du Processus de Recrutement

> Render with any PlantUML renderer (VS Code extension, planttext.com, etc.)

---

```plantuml
@startuml HumatiQ_BPMN_General
left to right direction
title HumatiQ — Processus Général de Recrutement

' ══════════════════════════════════════════════
' POOL 1 : SUPER ADMINISTRATEUR
' ══════════════════════════════════════════════
package "Super Administrateur" {
  mxgraph.bpmn.event.start "Initialiser\nLa Plateforme"                  as sa_start
  rectangle                 "Créer L'Entreprise"                         as sa_create_company
  rectangle                 "Créer Les Comptes Utilisateurs\n(Admin, Chef Département, Recruteur RH)" as sa_create_users
  rectangle                 "Désigner\nL'Admin Entreprise"               as sa_assign_admin
  mxgraph.bpmn.event.end   "Plateforme\nInitialisée"                    as sa_end
}

' ══════════════════════════════════════════════
' POOL 2 : ADMIN ENTREPRISE
' ══════════════════════════════════════════════
package "Admin Entreprise" {
  mxgraph.bpmn.event.messageStart "Recevoir\nAccès Plateforme"           as adm_notif
  rectangle                        "Finaliser L'Onboarding\n(Profil entreprise, Branding)" as adm_onboard
  rectangle                        "Configurer Les Paramètres\nDu Pipeline IA"             as adm_ia_config
  rectangle                        "Créer Les Départements\n& Affecter Les Chefs"          as adm_depts
  rectangle                        "Affecter Les Recruteurs\nAux Départements"             as adm_assign_rh
  mxgraph.bpmn.event.end          "Entreprise\nOpérationnelle"           as adm_end
}

' ══════════════════════════════════════════════
' POOL 3 : CHEF DÉPARTEMENT
' ══════════════════════════════════════════════
package "Chef Département" {
  mxgraph.bpmn.event.messageStart "Recevoir\nAccès Département"          as cd_notif
  rectangle                        "Gérer Le Département\n(Recruteurs, Structure)"         as cd_manage
  rectangle                        "Suivre Les Offres\nDu Département"                    as cd_monitor
  rectangle                        "Consulter Les KPIs\nDu Département"                   as cd_kpis
  mxgraph.bpmn.event.end          "Département\nOpérationnel"            as cd_end
}

' ══════════════════════════════════════════════
' POOL 4 : RECRUTEUR / RH
' ══════════════════════════════════════════════
package "Recruteur / RH" {
  mxgraph.bpmn.event.messageStart "Recevoir\nAccès Plateforme"           as hr_notif
  rectangle                        "Créer Une Offre d'Emploi"            as hr_post
  mxgraph.bpmn.gateway2.exclusive "Activer Le\nPipeline IA?"             as hr_ia_gw
  rectangle                        "Configurer Le Pipeline\n(Seuils X, Y, Z)" as hr_pipeline_config
  rectangle                        "Publier L'Offre"                     as hr_publish

  rectangle                        "Consulter Les Candidatures\n(Tableau de Bord Kanban)" as hr_kanban
  mxgraph.bpmn.gateway2.exclusive "Action Sur\nCandidat?"                as hr_action_gw
  rectangle                        "Changer Statut\n(Shortlist / Refus)" as hr_manual_status
  rectangle                        "Assigner Un Quiz"                    as hr_manual_quiz
  rectangle                        "Planifier L'Entretien"               as hr_schedule

  rectangle                        "Conduire L'Entretien"                as hr_conduct
  rectangle                        "Consulter Le Rapport\nPost-Entretien" as hr_report
  mxgraph.bpmn.gateway2.exclusive "Décision Finale?"                     as hr_decision_gw
  rectangle                        "Envoyer Une Offre d'Embauche"        as hr_offer
  rectangle                        "Notifier Le Refus"                   as hr_reject
  mxgraph.bpmn.event.end          "Recrutement Terminé"                  as hr_end
}

' ══════════════════════════════════════════════
' POOL 5 : CANDIDAT
' ══════════════════════════════════════════════
package "Candidat" {
  mxgraph.bpmn.event.start        "S'inscrire"                           as c_start
  rectangle                        "Compléter Son Profil\n(CV, Compétences, Formation)" as c_profile
  rectangle                        "Consulter Les Offres"                as c_browse
  mxgraph.bpmn.gateway2.exclusive "Intéressé\nPar L'Offre?"             as c_interest_gw
  rectangle                        "Postuler"                            as c_apply
  mxgraph.bpmn.event.messageStart "Recevoir\nNotification Quiz"          as c_quiz_notif
  rectangle                        "Passer Le Quiz"                      as c_quiz
  mxgraph.bpmn.event.messageStart "Recevoir\nInvitation Entretien"       as c_interview_notif
  rectangle                        "Choisir Un Créneau\n& Confirmer"     as c_slot
  rectangle                        "Participer À L'Entretien"            as c_interview
  mxgraph.bpmn.gateway2.exclusive "Décision Reçue?"                      as c_final_gw
  mxgraph.bpmn.event.end          "Candidature Retenue"                  as c_hired
  mxgraph.bpmn.event.errorEnd     "Candidature Refusée"                  as c_rejected
}

' ══════════════════════════════════════════════
' POOL 6 : MOTEUR IA  (si pipeline activé)
' ══════════════════════════════════════════════
package "Moteur IA" {
  mxgraph.bpmn.event.timerStart   "Délai Offre Atteint"                  as ia_trigger
  rectangle                        "Présélectionner Les Candidats\nPar Similarité"  as ia_filter1
  rectangle                        "Scorer et Classer\nLes Candidats"    as ia_filter2
  mxgraph.bpmn.gateway2.exclusive "Étape Quiz Activée?"                   as ia_quiz_gw
  rectangle                        "Générer et Assigner Le Quiz"          as ia_gen_quiz
  rectangle                        "Évaluer Les Réponses\nDu Candidat"   as ia_eval_quiz
  rectangle                        "Analyser L'Entretien\n(Transcription + Émotions)" as ia_analyze
  rectangle                        "Produire Le Rapport\nPost-Entretien"  as ia_report
}

' ══════════════════════════════════════════════
' FLUX : SUPER ADMINISTRATEUR
' ══════════════════════════════════════════════
sa_start          --> sa_create_company
sa_create_company --> sa_create_users
sa_create_users   --> sa_assign_admin
sa_assign_admin   ..> adm_notif
sa_assign_admin   ..> cd_notif
sa_assign_admin   ..> hr_notif
sa_assign_admin   --> sa_end

' ══════════════════════════════════════════════
' FLUX : ADMIN ENTREPRISE
' ══════════════════════════════════════════════
adm_notif      --> adm_onboard
adm_onboard    --> adm_ia_config
adm_ia_config  --> adm_depts
adm_depts      --> adm_assign_rh
adm_assign_rh  --> adm_end

' ══════════════════════════════════════════════
' FLUX : CHEF DÉPARTEMENT
' ══════════════════════════════════════════════
cd_notif  --> cd_manage
cd_manage --> cd_monitor
cd_monitor --> cd_kpis
cd_kpis   --> cd_end

' ══════════════════════════════════════════════
' FLUX : RECRUTEUR / RH
' ══════════════════════════════════════════════
hr_notif   --> hr_post
hr_post    --> hr_ia_gw
hr_ia_gw   --> hr_pipeline_config : "Oui"
hr_ia_gw   --> hr_publish         : "Non"
hr_pipeline_config --> hr_publish
hr_publish ..> c_browse

hr_kanban    --> hr_action_gw
hr_action_gw --> hr_manual_status : "Statut"
hr_action_gw --> hr_manual_quiz   : "Quiz"
hr_action_gw --> hr_schedule      : "Entretien"
hr_manual_status --> hr_kanban
hr_manual_quiz   ..> c_quiz_notif
hr_schedule      ..> c_interview_notif
hr_schedule      --> hr_conduct
hr_conduct       --> hr_report
hr_report        --> hr_decision_gw
hr_decision_gw   --> hr_offer  : "Retenu"
hr_decision_gw   --> hr_reject : "Refusé"
hr_offer  ..> c_final_gw
hr_reject ..> c_final_gw
hr_offer  --> hr_end
hr_reject --> hr_end

' ══════════════════════════════════════════════
' FLUX : CANDIDAT
' ══════════════════════════════════════════════
c_start       --> c_profile
c_profile     --> c_browse
c_browse      --> c_interest_gw
c_interest_gw --> c_apply  : "Oui"
c_interest_gw --> c_browse : "Non"
c_apply       --> c_quiz_notif

c_quiz_notif      --> c_quiz
c_interview_notif --> c_slot
c_slot            --> c_interview
c_interview       --> c_final_gw
c_final_gw        --> c_hired    : "Retenu"
c_final_gw        --> c_rejected : "Refusé"

' ══════════════════════════════════════════════
' FLUX : MOTEUR IA
' ══════════════════════════════════════════════
hr_publish   ..> ia_trigger
ia_trigger   --> ia_filter1
ia_filter1   --> ia_filter2
ia_filter2   --> ia_quiz_gw
ia_quiz_gw   --> ia_gen_quiz : "Oui"
ia_quiz_gw   --> hr_kanban   : "Non"
ia_gen_quiz  ..> c_quiz_notif
c_quiz       ..> ia_eval_quiz
ia_eval_quiz --> hr_kanban

c_interview  ..> ia_analyze
ia_analyze   --> ia_report
ia_report    ..> hr_report

@enduml
```

---

## Récapitulatif des rôles et phases

| Acteur | Rôle spécifique |
|--------|----------------|
| **Super Administrateur** | Crée les entreprises et tous les comptes utilisateurs ; désigne l'Admin Entreprise |
| **Admin Entreprise** | Finalise l'onboarding, configure le pipeline IA, crée les départements et affecte les utilisateurs |
| **Chef Département** | Gère son département (recruteurs, structure) et suit les KPIs |
| **Recruteur / RH** | Publie les offres, gère les candidatures (manuellement ou via pipeline IA), conduit les entretiens |
| **Candidat** | S'inscrit, postule, passe les quiz et participe aux entretiens |
| **Moteur IA** | Présélectionne, score, génère les quiz et analyse les entretiens *(optionnel, si pipeline activé)* |
