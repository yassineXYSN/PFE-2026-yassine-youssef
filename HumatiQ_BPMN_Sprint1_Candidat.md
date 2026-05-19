# HumatiQ — BPMN Sprint 1 : Création de compte Candidat

> Export as `sprint1_bpmn_candidat.png` and place in `Rapport_PFE_License__YET_/images/`

```plantuml
@startuml Sprint1_BPMN_Candidat
left to right direction
title HumatiQ — Flux : Création de compte Candidat

' ══════════════════════════════════════════════
' POOL 1 : CANDIDAT
' ══════════════════════════════════════════════
package "Candidat" {
  mxgraph.bpmn.event.start        "Accéder\nÀ La Plateforme"             as c_start
  mxgraph.bpmn.gateway2.exclusive "Méthode\nD'Inscription?"              as c_auth_gw
  rectangle                        "S'inscrire Via\nRéseau Social"        as c_oauth
  rectangle                        "Saisir Email\n& Mot De Passe"         as c_email
  rectangle                        "Vérifier\nSon Email"                  as c_verify
  mxgraph.bpmn.gateway2.exclusive "2FA\nActivée?"                         as c_2fa_gw
  rectangle                        "Configurer\nL'Authentification 2FA"  as c_2fa
  rectangle                        "Importer\nSon CV"                     as c_cv
  rectangle                        "Vérifier Et Compléter\nSon Profil"   as c_review
  rectangle                        "Renseigner\nInformations Complémentaires\n(Bio, Langues, Certifications)" as c_extra
  rectangle                        "Définir\nSon Profil Cible"            as c_target
  rectangle                        "Valider\nLa Création Du Compte"       as c_submit
  mxgraph.bpmn.gateway2.exclusive "Profil\nComplet?"                      as c_complete_gw
  mxgraph.bpmn.event.end          "Compte\nCréé"                          as c_end
}

' ══════════════════════════════════════════════
' POOL 2 : PLATEFORME
' ══════════════════════════════════════════════
package "Plateforme" {
  rectangle                        "Vérifier\nL'Identité"                 as p_verify_id
  mxgraph.bpmn.gateway2.exclusive "Identité\nValide?"                     as p_id_gw
  rectangle                        "Créer\nLe Compte"                     as p_create
  rectangle                        "Analyser\nLe CV"                      as p_parse_cv
  rectangle                        "Structurer\nLe Profil\n(Compétences, Expériences,\nFormations)" as p_structure
  rectangle                        "Calculer\nLe Score De Profil"         as p_score
  rectangle                        "Enregistrer\nLe Compte"               as p_save
  mxgraph.bpmn.event.errorEnd     "Accès\nRefusé"                         as p_fail
}

' ══════════════════════════════════════════════
' FLUX : CANDIDAT
' ══════════════════════════════════════════════
c_start    --> c_auth_gw
c_auth_gw  --> c_oauth : "Social"
c_auth_gw  --> c_email : "Email"
c_oauth    --> c_verify
c_email    --> c_verify
c_verify   --> c_2fa_gw
c_2fa_gw   --> c_2fa : "Oui"
c_2fa_gw   --> c_cv  : "Non"
c_2fa      --> c_cv
c_cv       --> c_review
c_review   --> c_extra
c_extra    --> c_target
c_target   --> c_submit
c_submit   --> c_complete_gw
c_complete_gw --> c_end      : "Complet"
c_complete_gw --> c_extra    : "Incomplet"

' ══════════════════════════════════════════════
' FLUX : PLATEFORME
' ══════════════════════════════════════════════
c_oauth ..> p_verify_id
c_email ..> p_verify_id
p_verify_id --> p_id_gw
p_id_gw     --> p_create : "Valide"
p_id_gw     --> p_fail   : "Invalide"
p_create    --> p_save

c_cv ..> p_parse_cv
p_parse_cv  --> p_structure
p_structure ..> c_review

c_submit ..> p_score
p_score     --> p_save
p_save      ..> c_end

@enduml
```
