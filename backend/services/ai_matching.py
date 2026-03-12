import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

# Configuration de base d'Ollama (locale)
OLLAMA_BASE_URL = "http://localhost:11434/api"
EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "qwen2.5:7b"

class AIMatchingService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        # Timeout étendu car les appels LLM peuvent prendre plusieurs secondes/minutes
        self.client = httpx.AsyncClient(timeout=120.0)

    async def close(self):
        """Ferme la session httpx proprement."""
        await self.client.aclose()

    # ==========================================
    # ETAPE 1 : Vectorisation (Embedding)
    # ==========================================
    
    def _extract_text_for_embedding(self, profile: Dict[str, Any]) -> str:
        """
        Extrait et concatène les informations utiles d'un profil json 
        (titre, skills, expériences, formations) pour en faire un texte riche sémantiquement.
        Supporte les clés en Français et Anglais.
        """
        parts = []
        
        # 1. Identité et Titre
        fname = profile.get("firstName") or profile.get("prenom") or ""
        lname = profile.get("lastName") or profile.get("nom") or ""
        if fname or lname:
            parts.append(f"Candidat : {fname} {lname}".strip())

        title = (profile.get("title") or profile.get("titre") or 
                 profile.get("headline") or profile.get("posteActuel") or "")
        if title:
            parts.append(f"Titre/Poste : {title}")
            
        summary = profile.get("summary") or profile.get("resume") or profile.get("about") or profile.get("bio") or profile.get("profile_snapshot", {}).get("about") or ""
        if summary:
            parts.append(f"Résumé professionnel : {summary}")
            
        # 2. Compétences (Skills)
        # Clés possibles: skills, competences, hard_skills, soft_skills
        skills_data = profile.get("skills") or profile.get("competences") or []
        if skills_data:
            if isinstance(skills_data, list):
                skill_names = []
                for s in skills_data:
                    if isinstance(s, dict):
                        # Gérer {"name": "Python"}, {"label": "Python"}, {"nom": "Python"}
                        name = s.get("name") or s.get("label") or s.get("nom") or s.get("value") or ""
                        if name: skill_names.append(str(name))
                    else:
                        skill_names.append(str(s))
                if skill_names:
                    parts.append(f"Compétences clés : {', '.join(filter(None, skill_names))}")
            elif isinstance(skills_data, str):
                parts.append(f"Compétences clés : {skills_data}")

        # 3. Expériences professionnelles
        # Clés: experience, experiences, experiencesProfessionnelles
        experiences = (profile.get("experience") or profile.get("experiences") or 
                       profile.get("experiencesProfessionnelles") or [])
        if experiences and isinstance(experiences, list):
            exp_texts = []
            for exp in experiences:
                if not isinstance(exp, dict): continue
                # Clés internes possibles
                role = exp.get("title") or exp.get("role") or exp.get("position") or exp.get("jobTitle") or exp.get("poste") or ""
                company = exp.get("company") or exp.get("entreprise") or ""
                description = exp.get("description") or exp.get("missions") or ""
                
                start_m = exp.get("startMonth") or exp.get("moisDebut") or ""
                start_y = exp.get("startYear") or exp.get("anneeDebut") or ""
                end_m = exp.get("endMonth") or exp.get("moisFin") or ""
                end_y = exp.get("endYear") or exp.get("anneeFin") or ("Présent" if exp.get("ongoing") or exp.get("enCours") else "")
                
                # Formater la période
                start = f"{start_m}/{start_y}" if start_m and start_y else (start_y or start_m)
                end = f"{end_m}/{end_y}" if end_m and end_y else (end_y or end_m)
                
                if not role:
                    role = "Poste (titre non précisé)"
                
                exp_str = f"- {role}"
                if company: exp_str += f" chez {company}"
                if start or end: exp_str += f" ({start} - {end})"
                if description: exp_str += f". Missions: {description}"
                exp_texts.append(exp_str)
                
            if exp_texts:
                parts.append("Expériences professionnelles :\n" + "\n".join(exp_texts))

        # 4. Formations / Éducation
        # Clés: education, educations, formations, diplomas
        education = (profile.get("education") or profile.get("educations") or 
                     profile.get("formations") or profile.get("diplomas") or [])
        if education and isinstance(education, list):
            edu_texts = []
            for edu in education:
                if not isinstance(edu, dict): continue
                degree = edu.get("degree") or edu.get("diploma") or edu.get("diplome") or ""
                school = edu.get("school") or edu.get("institution") or edu.get("etablissement") or ""
                field = edu.get("field_of_study") or edu.get("field") or edu.get("domaine") or ""
                year = edu.get("endYear") or edu.get("year") or edu.get("annee") or ""
                
                if not degree:
                    degree = "Formation/Diplôme"
                
                edu_str = f"- {degree}"
                if field: edu_str += f" en {field}"
                if school: edu_str += f" ({school})"
                if year: edu_str += f", obtenu/prévu en {year}"
                edu_texts.append(edu_str)
                
            if edu_texts:
                parts.append("Formation et Diplômes :\n" + "\n".join(edu_texts))

        # 5. Certifications
        certificates = profile.get("certificates") or profile.get("certifications") or []
        if certificates and isinstance(certificates, list):
            cert_texts = []
            for cert in certificates:
                if not isinstance(cert, dict): continue
                name = cert.get("name") or cert.get("nom") or cert.get("title") or ""
                issuer = cert.get("issuer") or cert.get("issuingOrganization") or ""
                year = cert.get("year") or cert.get("issueDate") or ""
                
                cert_str = f"- {name}"
                if issuer: cert_str += f" délivré par {issuer}"
                if year: cert_str += f" ({year})"
                cert_texts.append(cert_str)
                
            if cert_texts:
                parts.append("Certifications :\n" + "\n".join(cert_texts))

        # 6. Langues
        languages = profile.get("languages") or profile.get("langues") or []
        if languages and isinstance(languages, list):
            lang_texts = []
            for l in languages:
                if isinstance(l, dict):
                    name = l.get("name") or l.get("langue") or ""
                    level = l.get("level") or l.get("niveau") or ""
                    if name: lang_texts.append(f"{name} ({level})" if level else name)
                else:
                    lang_texts.append(str(l))
            if lang_texts:
                parts.append(f"Langues : {', '.join(lang_texts)}")

        # 7. Centres d'intérêt
        hobbies = profile.get("hobbies") or profile.get("centresInteret") or []
        if hobbies:
            if isinstance(hobbies, list):
                hobby_names = []
                for h in hobbies:
                    if isinstance(h, dict):
                        name = h.get("name") or h.get("nom") or h.get("label") or ""
                        if name: hobby_names.append(name)
                    else:
                        hobby_names.append(str(h))
                if hobby_names:
                    parts.append(f"Centres d'intérêt : {', '.join(hobby_names)}")
            elif isinstance(hobbies, str):
                parts.append(f"Centres d'intérêt : {hobbies}")

        # Joindre le tout pour créer un document sémantique dense
        final_text = "\n\n".join(parts).strip()
        
        # Fallback de sécurité si le profil est vraiment vide
        if len(final_text) < 50:
            return "Profil vide."
            
        return final_text

    async def generate_embedding(self, text: str) -> List[float]:
        """
        Appelle Ollama (nomic-embed-text) pour générer le vecteur du texte.
        """
        try:
            response = await self.client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={
                    "model": EMBEDDING_MODEL,
                    "prompt": text
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except httpx.HTTPError as e:
            logger.error(f"Erreur HTTP lors de l'appel à Ollama (Embedding): {e}")
            raise
        except Exception as e:
            logger.error(f"Erreur inattendue lors de la génération de l'embedding: {e}")
            raise

    async def vectorize_and_save_profile(self, profile_id: str) -> bool:

        from bson import ObjectId
        
        try:
            # 1. Récupérer le candidat
            if not ObjectId.is_valid(profile_id):
                logger.error(f"ID Invalide: {profile_id}")
                return False
                
            candidat = await self.db.candidatures.find_one({"_id": ObjectId(profile_id)})
            if not candidat:
                # Fallback on the candidates collection depending on the exact schema structure
                candidat = await self.db.candidates.find_one({"_id": ObjectId(profile_id)})
                if not candidat:
                    logger.error(f"Candidat non trouvé pour l'ID: {profile_id}")
                    return False
                collection_name = "candidates"
            else:
                collection_name = "candidatures"

            text_to_embed = self._extract_text_for_embedding(candidat)
            
            embedding = await self.generate_embedding(text_to_embed)
            if not embedding:
                logger.warning(f"L'embedding généré est vide pour le candidat {profile_id}")
                return False
                
            result = await getattr(self.db, collection_name).update_one(
                {"_id": ObjectId(profile_id)},
                {"$set": {"embedding": embedding}}
            )
            
            if result.modified_count > 0:
                logger.info(f"Profil {profile_id} vectorisé et sauvegardé avec succès.")
                return True
            else:
                logger.warning(f"Aucune modification apportée pour le profil {profile_id} (peut-être déjà à jour).")
                return result.matched_count > 0

        except Exception as e:
            logger.error(f"Erreur lors de vectorize_and_save_profile pour {profile_id}: {e}")
            return False

    # ==========================================
    # ETAPE 2 : Filtrage Rapide (Phase 1)
    # ==========================================
    
    async def find_top_candidates_for_job(self, job_description: str, limit: int = 10) -> List[Dict[str, Any]]:

        try:
            # 1. Générer l'embedding de la description du job
            job_embedding = await self.generate_embedding(job_description)
            if not job_embedding:
                return []

            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "default", # Nom de l'index dans Atlas
                        "path": "embedding",
                        "queryVector": job_embedding,
                        "numCandidates": limit * 10, # On cherche large au début
                        "limit": limit
                    }
                },
                {
                    "$project": {
                        "embedding": 0, # Ne pas renvoyer le gros vecteur
                        "score": {"$meta": "vectorSearchScore"}
                    }
                }
            ]

            cursor = self.db.candidates.aggregate(pipeline)
            raw_results = await cursor.to_list(length=limit)
            

            for r in raw_results:
                raw_score = r.get("score", 0)

                threshold = 0.73
                if raw_score <= threshold:
                    adjusted_score = 0.0
                else:
                    adjusted_score = (raw_score - threshold) / (1.0 - threshold)

                    
                r["score"] = adjusted_score
                
                if adjusted_score > 0.05:
                    results.append(r)

            return results

        except Exception as e:
            logger.error(f"Erreur lors de find_top_candidates_for_job: {e}")
            return []

    # ==========================================
    # ETAPE 3 : Analyse Profonde (Phase 2 - LLM)
    # ==========================================
    
    async def evaluate_candidate_with_llm(self, job_description: str, candidate_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Envoie l'offre et le candidat à Qwen2.5:7b via Ollama pour une analyse détaillée.
        Retourne un dictionnaire avec 'score' (0-100) et 'justification'.
        """
        # Extraire le texte sémantique structuré du candidat
        candidate_text = self._extract_text_for_embedding(candidate_data)
        
        # S'assurer qu'on ne donne pas un profil vide silencieux
        if not candidate_text or len(candidate_text.strip()) < 10 or candidate_text == "Profil vide.":
            candidate_text = "Attention : Ce profil est complètement vide ou illisible."

        prompt = f"""
Vous êtes un expert en recrutement. Évaluez la correspondance entre cette offre d'emploi et ce profil de candidat.

OFFRE D'EMPLOI :
{job_description}

PROFIL CANDIDAT :
{candidate_text}

RÈGLES DE CALCUL DU SCORE (MANDATOIRE) :

1. COMPÉTENCES (sur 40) :
   - Listez les points communs techniques. Si les langages principaux correspondent (ex: PHP, Python), donnez au moins 25/40.
   - Ne donnez 0 que si le profil est totalement vide.

2. EXPÉRIENCE (sur 40) :
   - Un stage ou une alternance dans le domaine COMPTE comme de l'expérience.
   - Si le candidat a au moins un stage pertinent, donnez au moins 15/40.
   - Ne donnez 0 que si le candidat n'a ABSOLUMENT aucune expérience (ni stage, ni projet).

3. FORMATION (sur 20) :
   - Si le candidat est inscrit dans une université ou école d'informatique (même s'il n'a pas encore fini), donnez au moins 10/20.
   - Ne donnez 0 que si aucune formation n'est mentionnée.

SOMME TOTALE = Score sur 100.

RÉPONSE JSON EXIGÉE :
{{
  "score": integer,
  "justification": "Compétences: X/40, Exp: Y/40, Formation: Z/20. [Explication brève et factuelle]"
}}
"""

        try:
            response = await self.client.post(
                f"{OLLAMA_BASE_URL}/generate",
                json={
                    "model": LLM_MODEL,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json" # Force Ollama à renvoyer du JSON
                }
            )
            response.raise_for_status()
            data = response.json()
            
            # Parser la réponse brute de l'LLM
            raw_response = data.get("response", "{}")
            result = json.loads(raw_response)
            
            # Validation minimale
            return {
                "score": result.get("score", 0),
                "justification": result.get("justification", "Aucune justification fournie.")
            }

        except Exception as e:
            logger.error(f"Erreur lors de l'évaluation LLM pour {safe_candidate.get('_id')}: {e}")
            return {
                "score": 0,
                "justification": f"Erreur d'analyse IA : {str(e)}"
            }
