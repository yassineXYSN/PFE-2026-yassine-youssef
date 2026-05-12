# Sprint 3 — Diagrammes, Captures et Prompts

## Diagrammes PlantUML

Les fichiers PlantUML à exporter en PNG sont :

- `tmp/Diagrammes/Code/Sprint3_ClassDiagram.puml` vers `images/sprint3_class_diagram.png`.
- `tmp/Diagrammes/Code/Sprint3_Architecture.puml` vers `images/sprint3_architecture_logique.png`.

## URLs de Captures

Les captures doivent être prises avec le frontend lancé sur `http://localhost:5173` et le backend sur `http://localhost:8000`.

- Génération de quiz RH : `http://localhost:5173/hr/applications/:applicationId`, ouvrir l'action de création/génération de quiz.
- Révision du quiz RH : `http://localhost:5173/hr/quizzes/:quizId`.
- Suivi et résultats quiz RH : `http://localhost:5173/hr/applications/:applicationId`, zone quiz de la candidature.
- Passage du quiz candidat : `http://localhost:5173/candidat/quiz/:quizId`.
- Score de matching IA : `http://localhost:5173/hr/applications/:applicationId`, section analyse IA / score candidat.
- Recommandations d'offres candidat : `http://localhost:5173/candidat/dashboard/find-jobs`.
- Analyse / progression candidat : `http://localhost:5173/candidat/dashboard`.
- Documentation Swagger : `http://localhost:8000/docs`, ouvrir les tags `Quiz Generation`, `AI Matching` et `AI Analysis`.

## Prompts pour Figures IA

Style commun à garder pour toutes les figures :

```xml
<style_commun>
  <format>Image 16:9, haute résolution, adaptée à un rapport académique de fin d'études</format>
  <langue>Interface et libellés en français</langue>
  <identite_visuelle>
    <nom_produit>HumatiQ</nom_produit>
    <ambiance>professionnelle, moderne, claire, crédible pour une plateforme RH intelligente</ambiance>
    <palette>
      <couleur_principale>#1E5B8C bleu institutionnel</couleur_principale>
      <couleur_secondaire>#19A7A8 turquoise technologique</couleur_secondaire>
      <accent_ia>#7C3AED violet IA discret</accent_ia>
      <fond>#F7FAFC blanc cassé</fond>
      <texte>#1F2937 gris anthracite</texte>
      <succes>#16A34A vert score élevé</succes>
      <alerte>#F59E0B orange score moyen</alerte>
      <danger>#DC2626 rouge score faible</danger>
    </palette>
    <typographie>Sans-serif moderne, proche de Inter ou Manrope, hiérarchie claire, textes lisibles</typographie>
    <style_graphique>cartes arrondies, ombres douces, grilles propres, pictogrammes linéaires minimalistes, beaucoup d'espace blanc</style_graphique>
  </identite_visuelle>
  <contraintes>
    <eviter>logos de fournisseurs réels, watermark, texte illisible, pseudo-langage, anglais dans les libellés, interface sombre, style cartoon, surcharge visuelle</eviter>
    <qualite>tous les textes importants doivent être nets et lisibles, alignements précis, composition équilibrée</qualite>
  </contraintes>
</style_commun>
```

Prompt architecture quiz :

```xml
<prompt_figure>
  <objectif>Créer une figure d'architecture technique pour le module Quiz et Évaluation intelligente de HumatiQ.</objectif>
  <type_image>Diagramme d'architecture académique, pas une capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut : fond clair, bleu institutionnel, turquoise, violet IA discret, cartes arrondies, flèches propres.</style_ref>
  <composition>
    <orientation>Flux horizontal de gauche à droite</orientation>
    <colonnes>
      <colonne titre="Interface RH">
        <element>Tableau de bord RH</element>
        <element>Import document de référence</element>
        <element>Paramètres du quiz : durée, difficulté, nombre de questions</element>
      </colonne>
      <colonne titre="Backend FastAPI">
        <element>API Quiz : /api/quiz/upload-document</element>
        <element>Ingestion document</element>
        <element>Extraction texte + fallback OCR</element>
        <element>Découpage en chunks</element>
      </colonne>
      <colonne titre="Services IA">
        <element>Embeddings : nomic-embed-text</element>
        <element>LLM configurable : Ollama / HuggingFace / OpenAI</element>
        <element>Génération de questions QCM, vrai/faux, scénario</element>
      </colonne>
      <colonne titre="Persistance">
        <element>GridFS : fichiers importés</element>
        <element>MongoDB : quiz_documents</element>
        <element>MongoDB : quiz_chunks</element>
        <element>MongoDB : quizzes</element>
      </colonne>
      <colonne titre="Candidat et résultats">
        <element>Révision RH des questions</element>
        <element>Envoi au candidat</element>
        <element>Passage du quiz chronométré</element>
        <element>Correction automatique et notification RH</element>
      </colonne>
    </colonnes>
  </composition>
  <details_visuels>
    <fleches>Flèches directionnelles bleues, avec petites étiquettes : importer, extraire, vectoriser, générer, envoyer, corriger</fleches>
    <badges>Ajouter des badges discrets : IA, REST API, MongoDB, Notification</badges>
    <titre_visible>Architecture du Module Quiz et Évaluation Intelligente</titre_visible>
  </details_visuels>
  <contraintes>
    <ne_pas_faire>Ne pas utiliser de logos réels, ne pas mettre de code source, ne pas créer d'interface sombre</ne_pas_faire>
  </contraintes>
</prompt_figure>
```

Prompt moteur IA :

```xml
<prompt_figure>
  <objectif>Créer une figure d'architecture technique pour le moteur IA de matching et recommandations de HumatiQ.</objectif>
  <type_image>Diagramme d'architecture académique, pas une capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut : même palette, mêmes cartes, mêmes flèches, mêmes pictogrammes minimalistes.</style_ref>
  <composition>
    <orientation>Flux horizontal en trois couches : données, traitement IA, restitution</orientation>
    <zone titre="Sources de données">
      <element>Profil candidat : compétences, expériences, formations, préférences</element>
      <element>Offre d'emploi : description, exigences, missions, niveau</element>
      <element>Candidature : snapshot du profil, statut, historique</element>
    </zone>
    <zone titre="Traitements IA">
      <element>Nettoyage et concaténation sémantique du profil</element>
      <element>Génération embedding avec nomic-embed-text</element>
      <element>MongoDB Atlas Vector Search</element>
      <element>Similarité cosinus normalisée</element>
      <element>Analyse qualitative LLM : score + justification</element>
      <element>Score complémentaire CNN sur les compétences</element>
      <element>Score composite IA stocké sur la candidature</element>
    </zone>
    <zone titre="Sorties utilisateur">
      <element>Pipeline RH avec score IA coloré</element>
      <element>Justification : points forts et lacunes</element>
      <element>Top X candidats par similarité vectorielle</element>
      <element>Top Y candidats par analyse IA</element>
      <element>Recommandations d'offres côté candidat</element>
    </zone>
  </composition>
  <details_visuels>
    <fleches>Montrer une progression claire : Profil + Offre vers Embedding, puis Vector Search, puis LLM, puis Score RH</fleches>
    <indicateurs>Afficher un exemple de score : 87% compatibilité, avec pastille verte</indicateurs>
    <titre_visible>Architecture du Moteur IA de Matching</titre_visible>
  </details_visuels>
  <contraintes>
    <ne_pas_faire>Ne pas mentionner Pinecone ni Gemini, ne pas utiliser de logos fournisseurs, éviter les textes minuscules</ne_pas_faire>
  </contraintes>
</prompt_figure>
```

Prompt interface quiz RH :

```xml
<prompt_figure>
  <objectif>Créer une capture d'écran réaliste d'une interface RH HumatiQ pour générer et réviser un quiz IA.</objectif>
  <type_image>Mockup réaliste d'application web SaaS, format capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut : light theme, cartes blanches, bleu institutionnel, turquoise, violet IA discret.</style_ref>
  <composition>
    <page>Tableau de bord RH, page détail candidature ou pipeline de recrutement</page>
    <layout>
      <sidebar>Menu vertical à gauche : Tableau de bord, Offres, Candidatures, Quiz, Calendrier</sidebar>
      <header>Barre supérieure avec recherche, notifications, avatar RH</header>
      <contenu_principal>
        <bloc titre="Génération de quiz IA">
          <element>Zone glisser-déposer : Importer un document de référence</element>
          <element>Nom du document : Guide technique React.pdf</element>
          <element>Paramètres : 10 questions, durée 20 min, difficulté mixte</element>
          <element>Bouton principal : Générer le quiz</element>
        </bloc>
        <bloc titre="Questions générées">
          <element>Carte question 1 avec badge Moyen et type QCM</element>
          <element>Quatre options de réponse avec radio buttons</element>
          <element>Bonne réponse marquée discrètement en vert</element>
          <element>Boutons : Modifier, Régénérer, Supprimer</element>
        </bloc>
        <bloc titre="Actions">
          <element>Bouton secondaire : Enregistrer brouillon</element>
          <element>Bouton principal turquoise : Envoyer au candidat</element>
        </bloc>
      </contenu_principal>
    </layout>
  </composition>
  <microcopy>
    <texte_visible>Quiz IA pour Yassine Ben Ali - Offre Développeur Frontend</texte_visible>
    <texte_visible>Document analysé avec succès : 24 chunks, 24 embeddings</texte_visible>
    <texte_visible>Questions prêtes à être vérifiées avant envoi</texte_visible>
  </microcopy>
  <contraintes>
    <ne_pas_faire>Ne pas créer une page vide, ne pas utiliser d'anglais, ne pas afficher de données sensibles réelles</ne_pas_faire>
  </contraintes>
</prompt_figure>
```

Prompt matching IA :

```xml
<prompt_figure>
  <objectif>Créer une capture d'écran réaliste du pipeline RH HumatiQ affichant le score de matching IA des candidats.</objectif>
  <type_image>Mockup réaliste d'application web SaaS, format capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut : même interface RH que le prompt quiz, même sidebar, même header, même palette.</style_ref>
  <composition>
    <page>Pipeline des candidatures pour une offre</page>
    <layout>
      <sidebar>Menu vertical à gauche identique : Tableau de bord, Offres, Candidatures, Quiz, Calendrier</sidebar>
      <header>Titre : Pipeline - Développeur Full Stack</header>
      <contenu_principal>
        <kanban>
          <colonne titre="Nouvelles candidatures">
            <carte_candidat>
              <nom>Sarra Mansouri</nom>
              <poste>Développeuse React</poste>
              <score>92% Compatibilité IA</score>
              <details>Vectoriel 84%, LLM 88%, CNN compétences 9/10</details>
              <justification>Très bonne maîtrise React, expérience projet pertinente, léger manque DevOps.</justification>
            </carte_candidat>
          </colonne>
          <colonne titre="En analyse IA">
            <carte_candidat>
              <nom>Youssef Trabelsi</nom>
              <poste>Ingénieur logiciel junior</poste>
              <score>76% Compatibilité IA</score>
              <details>Vectoriel 71%, LLM 73%, CNN compétences 7/10</details>
              <justification>Profil cohérent, compétences backend solides, expérience frontend à renforcer.</justification>
            </carte_candidat>
          </colonne>
          <colonne titre="Quiz assigné">
            <carte_candidat>
              <nom>Amira Haddad</nom>
              <poste>Développeuse Full Stack</poste>
              <score>88% Compatibilité IA</score>
              <details>Quiz envoyé, deadline demain 18:00</details>
              <justification>Profil présélectionné automatiquement après analyse IA.</justification>
            </carte_candidat>
          </colonne>
        </kanban>
        <panneau_droit titre="Justification IA détaillée">
          <element>Compétences alignées : React, FastAPI, MongoDB</element>
          <element>Lacunes : tests automatisés, CI/CD</element>
          <element>Recommandation : proposer un quiz technique ciblé</element>
        </panneau_droit>
      </contenu_principal>
    </layout>
  </composition>
  <contraintes>
    <ne_pas_faire>Ne pas afficher de logos fournisseurs, ne pas utiliser de noms anglais pour les colonnes, garder le texte lisible</ne_pas_faire>
  </contraintes>
</prompt_figure>
```

Prompt interface candidat quiz :

```xml
<prompt_figure>
  <objectif>Créer une capture d'écran réaliste de l'interface candidat HumatiQ pendant le passage d'un quiz chronométré.</objectif>
  <type_image>Mockup réaliste d'application web SaaS, format capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut, mais avec une ambiance plus calme et concentrée.</style_ref>
  <composition>
    <page>Page de passage du quiz candidat</page>
    <layout>
      <header_minimal>Logo HumatiQ, titre du quiz, indicateur sécurisé</header_minimal>
      <zone_centrale>
        <element>Carte principale avec question 4 sur 10</element>
        <element>Minuteur très visible : 12:45 restantes</element>
        <element>Barre de progression : 40%</element>
        <element>Question QCM : "Quel mécanisme permet de comparer deux profils sémantiques ?"</element>
        <element>Quatre options de réponse sous forme de grandes cartes cliquables</element>
        <element>Option sélectionnée avec bordure turquoise</element>
      </zone_centrale>
      <footer_actions>
        <element>Bouton : Précédent</element>
        <element>Bouton principal : Question suivante</element>
        <element>Bouton discret : Soumettre le quiz</element>
      </footer_actions>
      <panneau_lateral>
        <element>Résumé : 3 répondues, 1 en cours, 6 restantes</element>
        <element>Consigne : aucune navigation externe pendant l'évaluation</element>
      </panneau_lateral>
    </layout>
  </composition>
  <microcopy>
    <texte_visible>Quiz technique - Développeur Full Stack</texte_visible>
    <texte_visible>Répondez à toutes les questions avant la fin du temps imparti.</texte_visible>
    <texte_visible>Vos réponses sont sauvegardées automatiquement.</texte_visible>
  </microcopy>
  <contraintes>
    <ne_pas_faire>Ne pas montrer de surveillance intrusive, ne pas créer une interface stressante, éviter les couleurs rouges sauf alerte douce</ne_pas_faire>
  </contraintes>
</prompt_figure>
```

Prompt recommandations candidat :

```xml
<prompt_figure>
  <objectif>Créer une capture d'écran réaliste du tableau de bord candidat HumatiQ montrant les recommandations IA d'offres et de progression.</objectif>
  <type_image>Mockup réaliste d'application web SaaS, format capture d'écran</type_image>
  <style_ref>Utiliser exactement le style commun défini plus haut, avec la même identité HumatiQ et des cartes lisibles.</style_ref>
  <composition>
    <page>Dashboard candidat, section recommandations IA</page>
    <layout>
      <sidebar>Menu candidat : Analyse, Trouver des offres, Mes candidatures, Entretiens, Profil, Paramètres</sidebar>
      <header>Titre : Recommandations personnalisées</header>
      <contenu_principal>
        <section titre="Offres recommandées pour vous">
          <carte_offre>
            <titre>Développeur Frontend React</titre>
            <entreprise>TechNova</entreprise>
            <score>91% de compatibilité</score>
            <raisons>React, JavaScript, expérience UI, préférence hybride</raisons>
            <bouton>Voir l'offre</bouton>
          </carte_offre>
          <carte_offre>
            <titre>Développeur Full Stack Junior</titre>
            <entreprise>DataBridge</entreprise>
            <score>84% de compatibilité</score>
            <raisons>FastAPI, MongoDB, projets académiques pertinents</raisons>
            <bouton>Postuler</bouton>
          </carte_offre>
        </section>
        <section titre="Progression de carrière">
          <element>Carte compétences à renforcer : Docker, tests unitaires, CI/CD</element>
          <element>Objectif suggéré : Développeur Full Stack confirmé</element>
          <element>Jauge profil : 78% complet</element>
        </section>
      </contenu_principal>
    </layout>
  </composition>
  <contraintes>
    <ne_pas_faire>Ne pas afficher de statistiques irréalistes, ne pas utiliser d'anglais, conserver une interface claire et académique</ne_pas_faire>
  </contraintes>
</prompt_figure>
```
