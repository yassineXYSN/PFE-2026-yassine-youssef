# HumatiQ — BPMN Sprint 3 : Calcul du Score de Matching

> Export as `sprint3_bpmn_matching.png` and place in `Rapport_PFE_License__YET_/images/`

```plantuml
@startuml Sprint3_BPMN_Matching
left to right direction
title HumatiQ — Flux : Calcul du Score de Matching Candidat–Offre

' ══════════════════════════════════════════════
' POOL 1 : CANDIDAT
' ══════════════════════════════════════════════
package "Candidat" {
  mxgraph.bpmn.event.start        "Consulter\nUne Offre"                  as c_start
  rectangle                        "Postuler\nÀ L'Offre"                  as c_apply
  mxgraph.bpmn.event.messageStart "Recevoir\nL'Accusé De Réception"       as c_ack
  mxgraph.bpmn.event.messageStart "Recevoir\nLa Notification\nDe Résultat" as c_notif_result
  mxgraph.bpmn.gateway2.exclusive "Résultat?"                              as c_result_gw
  mxgraph.bpmn.event.end          "Candidature\nRetenue"                  as c_shortlisted
  mxgraph.bpmn.event.errorEnd     "Candidature\nRefusée"                  as c_rejected
}

' ══════════════════════════════════════════════
' POOL 2 : MOTEUR IA
' ══════════════════════════════════════════════
package "Moteur IA" {
  mxgraph.bpmn.event.timerStart   "Délai De L'Offre\nAtteint"             as ia_trigger
  rectangle                        "Récupérer Les Profils\nDes Candidats"  as ia_get_profiles
  rectangle                        "Récupérer La Description\nDe L'Offre"  as ia_get_job
  rectangle                        "Calculer La Similarité\nProfil–Offre"  as ia_similarity
  rectangle                        "Présélectionner\nLe Top X Candidats"   as ia_top_x
  rectangle                        "Analyser Et Scorer\nChaque Candidat\n(Critères Multiples)" as ia_score
  rectangle                        "Justifier\nLe Score\n(Points Forts & Manques)" as ia_justify
  rectangle                        "Classer\nLe Top Y Candidats"           as ia_top_y
  rectangle                        "Mettre À Jour\nLes Statuts"            as ia_update
}

' ══════════════════════════════════════════════
' POOL 3 : RECRUTEUR / RH
' ══════════════════════════════════════════════
package "Recruteur / RH" {
  rectangle                        "Consulter Le Tableau\nDe Bord Kanban\n(Scores & Classement)" as hr_kanban
  mxgraph.bpmn.gateway2.exclusive "Action\nManuelle?"                      as hr_action_gw
  rectangle                        "Valider\nLa Présélection IA"           as hr_validate
  rectangle                        "Ajuster\nManuellement\nLes Statuts"    as hr_adjust
  mxgraph.bpmn.event.end          "Pipeline\nMis À Jour"                   as hr_end
}

' ══════════════════════════════════════════════
' FLUX : CANDIDAT
' ══════════════════════════════════════════════
c_start           --> c_apply
c_apply           ..> c_ack
c_notif_result    --> c_result_gw
c_result_gw       --> c_shortlisted : "Retenu"
c_result_gw       --> c_rejected    : "Refusé"

' ══════════════════════════════════════════════
' FLUX : MOTEUR IA
' ══════════════════════════════════════════════
c_apply      ..> ia_trigger
ia_trigger   --> ia_get_profiles
ia_trigger   --> ia_get_job
ia_get_profiles --> ia_similarity
ia_get_job      --> ia_similarity
ia_similarity --> ia_top_x
ia_top_x      --> ia_score
ia_score      --> ia_justify
ia_justify    --> ia_top_y
ia_top_y      --> ia_update
ia_update     ..> hr_kanban
ia_update     ..> c_notif_result

' ══════════════════════════════════════════════
' FLUX : RECRUTEUR / RH
' ══════════════════════════════════════════════
hr_kanban    --> hr_action_gw
hr_action_gw --> hr_validate : "Accepter IA"
hr_action_gw --> hr_adjust   : "Modifier"
hr_validate  --> hr_end
hr_adjust    --> hr_end

@enduml
```
