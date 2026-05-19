# HumatiQ — BPMN Sprint 3 : Génération et envoi d'un Quiz IA

> Export as `sprint3_bpmn_quiz.png` and place in `Rapport_PFE_License__YET_/images/`

```plantuml
@startuml Sprint3_BPMN_Quiz
left to right direction
title HumatiQ — Flux : Génération et envoi d'un Quiz IA

' ══════════════════════════════════════════════
' POOL 1 : RECRUTEUR / RH
' ══════════════════════════════════════════════
package "Recruteur / RH" {
  mxgraph.bpmn.event.start        "Accéder\nÀ La Configuration\nDu Quiz"  as hr_start
  rectangle                        "Importer\nLe Document Source\n(PDF / DOCX)"              as hr_import
  rectangle                        "Paramétrer Le Quiz\n(Nombre De Questions,\nDifficulté, Délai)" as hr_config
  mxgraph.bpmn.gateway2.exclusive "Qualité Des\nQuestions Satisfaisante?"  as hr_quality_gw
  rectangle                        "Valider\nEt Envoyer Le Quiz\nAux Candidats"              as hr_send
  mxgraph.bpmn.event.end          "Quiz\nEnvoyé"                           as hr_end
}

' ══════════════════════════════════════════════
' POOL 2 : MOTEUR IA
' ══════════════════════════════════════════════
package "Moteur IA" {
  rectangle                        "Découper Le Document\nEn Sections"     as ia_chunk
  rectangle                        "Indexer Le Contenu\n(Recherche Sémantique)" as ia_index
  rectangle                        "Récupérer Les Sections\nLes Plus Pertinentes" as ia_retrieve
  rectangle                        "Générer Les Questions\n(QCM / Vrai-Faux)\nSelon La Difficulté" as ia_generate
  mxgraph.bpmn.gateway2.exclusive "Questions\nValides?"                    as ia_valid_gw
  rectangle                        "Stocker\nLe Quiz"                      as ia_store
  rectangle                        "Notifier\nLe Candidat"                 as ia_notify
}

' ══════════════════════════════════════════════
' POOL 3 : CANDIDAT
' ══════════════════════════════════════════════
package "Candidat" {
  mxgraph.bpmn.event.messageStart "Recevoir\nLa Notification Quiz"         as c_notif
  rectangle                        "Ouvrir\nLe Quiz"                       as c_open
  rectangle                        "Répondre\nAux Questions\n(Minuté)"     as c_answer
  mxgraph.bpmn.gateway2.exclusive "Toutes Les\nQuestions Répondues\nOu Temps Écoulé?" as c_done_gw
  rectangle                        "Soumettre\nSes Réponses"               as c_submit

  rectangle                        "Correction\nAutomatique"               as c_correct
  rectangle                        "Recevoir\nSon Score\n& Rapport"        as c_result
  mxgraph.bpmn.event.end          "Quiz\nTerminé"                          as c_end
}

' ══════════════════════════════════════════════
' FLUX : RECRUTEUR / RH
' ══════════════════════════════════════════════
hr_start      --> hr_import
hr_import     ..> ia_chunk
hr_config     --> hr_quality_gw
hr_quality_gw --> hr_send    : "Oui"
hr_quality_gw --> hr_config  : "Régénérer"
hr_send       --> hr_end

' ══════════════════════════════════════════════
' FLUX : MOTEUR IA
' ══════════════════════════════════════════════
ia_chunk    --> ia_index
ia_index    --> ia_retrieve
hr_import   ..> ia_retrieve
ia_retrieve --> ia_generate
ia_generate --> ia_valid_gw
ia_valid_gw --> ia_store     : "Valides"
ia_valid_gw --> ia_generate  : "Régénérer"
ia_store    ..> hr_quality_gw
ia_store    --> ia_notify
ia_notify   ..> c_notif

c_submit    ..> c_correct
c_correct   ..> c_result

' ══════════════════════════════════════════════
' FLUX : CANDIDAT
' ══════════════════════════════════════════════
c_notif   --> c_open
c_open    --> c_answer
c_answer  --> c_done_gw
c_done_gw --> c_submit : "Oui"
c_done_gw --> c_answer : "Non"
c_submit  --> c_result
c_result  --> c_end

@enduml
```
