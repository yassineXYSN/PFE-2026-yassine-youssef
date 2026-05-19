# HumatiQ — BPMN Sprint 1 : Création d'entreprise et assignation d'administrateur

> Export as `sprint1_bpmn_entreprise.png` and place in `Rapport_PFE_License__YET_/images/`

```plantuml
@startuml Sprint1_BPMN_Entreprise
left to right direction
title HumatiQ — Flux : Création d'entreprise et assignation d'administrateur

' ══════════════════════════════════════════════
' POOL 1 : SUPER ADMINISTRATEUR
' ══════════════════════════════════════════════
package "Super Administrateur" {
  mxgraph.bpmn.event.start        "Accéder\nÀ La Console"                as sa_start
  rectangle                        "Renseigner\nLes Informations\nDe L'Entreprise"           as sa_fill
  rectangle                        "Créer Les Comptes\nUtilisateurs\n(Admin, Chefs Dept, RH)" as sa_users
  rectangle                        "Désigner\nL'Admin Entreprise"         as sa_assign
  mxgraph.bpmn.event.end          "Entreprise\nCréée"                     as sa_end
}

' ══════════════════════════════════════════════
' POOL 2 : PLATEFORME
' ══════════════════════════════════════════════
package "Plateforme" {
  rectangle                        "Enregistrer\nL'Entreprise"            as p_save_company
  rectangle                        "Initialiser\nLes Comptes Utilisateurs" as p_init_users
  rectangle                        "Envoyer\nLes Accès Par Email"         as p_send_access
}

' ══════════════════════════════════════════════
' POOL 3 : ADMIN ENTREPRISE
' ══════════════════════════════════════════════
package "Admin Entreprise" {
  mxgraph.bpmn.event.messageStart "Recevoir\nSes Accès"                   as adm_notif
  rectangle                        "Finaliser\nL'Onboarding\n(Profil, Branding)"             as adm_onboard
  rectangle                        "Configurer\nLe Pipeline IA\n(Seuils X, Y, Z)"            as adm_ia
  rectangle                        "Créer Les Départements\n& Affecter Les Chefs"            as adm_depts
  rectangle                        "Affecter Les Recruteurs\nAux Départements"               as adm_rh
  mxgraph.bpmn.event.end          "Entreprise\nOpérationnelle"            as adm_end
}

' ══════════════════════════════════════════════
' POOL 4 : CHEF DÉPARTEMENT
' ══════════════════════════════════════════════
package "Chef Département" {
  mxgraph.bpmn.event.messageStart "Recevoir\nSes Accès"                   as cd_notif
  rectangle                        "Configurer\nSon Département"          as cd_config
  mxgraph.bpmn.event.end          "Département\nPrêt"                     as cd_end
}

' ══════════════════════════════════════════════
' FLUX : SUPER ADMINISTRATEUR
' ══════════════════════════════════════════════
sa_start  --> sa_fill
sa_fill   --> sa_users
sa_users  --> sa_assign
sa_assign ..> p_save_company
sa_assign --> sa_end

' ══════════════════════════════════════════════
' FLUX : PLATEFORME
' ══════════════════════════════════════════════
p_save_company --> p_init_users
p_init_users   --> p_send_access
p_send_access  ..> adm_notif
p_send_access  ..> cd_notif

' ══════════════════════════════════════════════
' FLUX : ADMIN ENTREPRISE
' ══════════════════════════════════════════════
adm_notif   --> adm_onboard
adm_onboard --> adm_ia
adm_ia      --> adm_depts
adm_depts   --> adm_rh
adm_rh      --> adm_end

' ══════════════════════════════════════════════
' FLUX : CHEF DÉPARTEMENT
' ══════════════════════════════════════════════
cd_notif --> cd_config
cd_config --> cd_end

@enduml
```
