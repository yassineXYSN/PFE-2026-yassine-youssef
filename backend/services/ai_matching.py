import json
import logging
import re
import asyncio
from typing import List, Dict, Any
from datetime import datetime
import httpx
import os
import random
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

_OLLAMA_NUM_GPU = int(os.getenv("OLLAMA_NUM_GPU_LAYERS", "99"))

from utils.ai_settings import (
    fake_analysis_enabled,
    get_profile_analysis_settings,
    get_quiz_analysis_settings,
)
from utils.llm_client import generate_chat_completion

logger = logging.getLogger(__name__)

# Configuration de base d'Ollama (locale)
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api")
EMBEDDING_MODEL = os.getenv(
    "PROFILE_ANALYSIS_EMBEDDING_MODEL",
    os.getenv("QUIZ_EMBEDDING_MODEL", "nomic-embed-text"),
)

def _http_error_detail(exc: httpx.HTTPError) -> str:
    response = getattr(exc, "response", None)
    if response is None:
        return str(exc)

    detail = ""
    try:
        payload = response.json()
        if isinstance(payload, dict):
            detail = payload.get("error") or payload.get("detail") or ""
        elif payload:
            detail = str(payload)
    except Exception:
        detail = response.text.strip()

    return f"{exc} | {detail}" if detail else str(exc)

class AIMatchingService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        # Timeout étendu car les appels LLM peuvent prendre plusieurs secondes/minutes
        self.client = httpx.AsyncClient(timeout=120.0)

    async def close(self):
        """Ferme la session httpx proprement."""
        await self.client.aclose()

    async def _generate_with_llm(
        self,
        capability: str,
        prompt: str,
        *,
        json_mode: bool = False,
        max_tokens: int | None = None,
        temperature: float = 0.0,
    ) -> tuple[str, str]:
        settings = (
            get_profile_analysis_settings()
            if capability == "profile_analysis"
            else get_quiz_analysis_settings()
        )
        raw = await generate_chat_completion(
            [{"role": "user", "content": prompt}],
            settings,
            json_mode=json_mode,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return raw, settings.model

    @staticmethod
    def _parse_json_response(raw: str) -> Dict[str, Any]:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", raw or "", re.DOTALL)
            if match:
                return json.loads(match.group())
            raise

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
        if fake_analysis_enabled():
            logger.info("🛠️ [FAKE ANALYSIS] Mode: Generating random embedding vector.")
            # Nomic-embed-text usually has 768 dimensions
            # Vectors strictly [0, 1] represent ~0.75 expected cosine similarity natively
            return [random.uniform(0, 1) for _ in range(768)]

        try:
            response = await self.client.post(
                f"{OLLAMA_BASE_URL}/embeddings",
                json={
                    "model": EMBEDDING_MODEL,
                    "prompt": text,
                    "options": {"num_gpu": _OLLAMA_NUM_GPU},
                }
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except httpx.HTTPError as e:
            logger.error(
                "Erreur HTTP lors de l'appel a Ollama (Embedding, model=%s, base_url=%s): %s",
                EMBEDDING_MODEL,
                OLLAMA_BASE_URL,
                _http_error_detail(e),
            )
            raise
        except Exception as e:
            logger.error(f"Erreur inattendue lors de la génération de l'embedding: {e}")
            raise

    async def vectorize_and_save_profile(self, profile_id: str, by_user_id: bool = False) -> bool:

        from bson import ObjectId
        
        try:
            # 1. Récupérer le candidat
            query = {}
            if by_user_id:
                query = {"user_id": profile_id}
            else:
                if not ObjectId.is_valid(profile_id):
                    logger.error(f"ID Invalide: {profile_id}")
                    return False
                query = {"_id": ObjectId(profile_id)}
                
            candidat = await self.db.candidatures.find_one(query)
            if not candidat:
                # Fallback on the candidates collection depending on the exact schema structure
                candidat = await self.db.candidates.find_one(query)
                if not candidat:
                    logger.error(f"Candidat non trouvé pour la query: {query}")
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
                query,
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
            

            results = []
            for r in raw_results:
                raw_score = r.get("score", 0)

                threshold = 0.60
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
        Envoie l'offre et le candidat à un LLM local via Ollama pour une analyse détaillée.
        Retourne un dictionnaire avec 'score' (0-100) et 'justification'.
        """
        if fake_analysis_enabled():
            logger.info("🛠️ [FAKE ANALYSIS] Mode: Returning mock candidate evaluation.")
            return {
                "score": random.randint(70, 95),
                "justification": "[MOCK] Compétences: 35/40, Exp: 30/40, Formation: 15/20. Ce profil correspond très bien aux attentes du poste (Fake Analysis)."
            }

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
            raw_response, used_model = await self._generate_with_llm("profile_analysis", prompt, json_mode=True, max_tokens=800)
            
            # Parser la réponse brute de l'LLM
            result = self._parse_json_response(raw_response)
            logger.info("AI matching candidate evaluation generated with model=%s", used_model)
            
            # Validation minimale
            return {
                "score": result.get("score", 0),
                "justification": result.get("justification", "Aucune justification fournie.")
            }

        except Exception as e:
            logger.error(
                "Erreur lors de l'évaluation LLM pour %s (base_url=%s): %s",
                candidate_data.get('_id'),
                OLLAMA_BASE_URL,
                e,
            )
            return {
                "score": 0,
                "justification": f"Erreur d'analyse IA : {str(e)}"
            }
    async def evaluate_quiz_performance(self, quiz: Dict[str, Any], application: Dict[str, Any]) -> str:
        """
        Uses LLM to analyze candidate's quiz answers (with source context and profile snapshot)
        to provide a technical evaluation, check consistency, and detect potential cheating.
        """
        if fake_analysis_enabled():
            logger.info("🛠️ [FAKE ANALYSIS] Mode: Returning mock quiz performance evaluation.")
            return "Le candidat démontre une excellente maîtrise des concepts techniques abordés dans ce document. Ses réponses sont fluides, cohérentes avec son profil et montrent une réelle expertise. (Fake Analysis Mode)."

        questions = quiz.get("questions", [])
        candidate_answers = quiz.get("candidate_answers", [])
        profile = application.get("profile_snapshot", {})
        
        if not questions:
            return "Aucune question trouvée dans ce quiz."

        # 1. Fetch Source Chunks for context (using the same logic as the creation)
        all_chunk_ids = []
        for q in questions:
            all_chunk_ids.extend(q.get("source_chunks", []))
        
        unique_chunk_oids = [ObjectId(cid) for cid in set(all_chunk_ids) if ObjectId.is_valid(cid)]
        chunks_text = ""
        if unique_chunk_oids:
            chunks = await self.db.quiz_chunks.find({"_id": {"$in": unique_chunk_oids}}).to_list(length=50)
            chunks_text = "\n\n".join([f"--- SOURCE CONTEXT ---\n{c.get('text', '')}" for c in chunks])

        # 2. Build Performance Summary
        perf_details = []
        for q in questions:
            q_id = q.get("id")
            ans = next((a for a in candidate_answers if a.get("question_id") == q_id), None)
            
            is_correct = False
            user_val = ans.get("answer") if ans else "N/A"
            correct_val = ""
            
            if q.get("type") == "mcq":
                correct_val = q.get("correct_index")
                is_correct = (user_val == correct_val)
            else:
                correct_val = q.get("correct_answer")
                is_correct = (str(user_val).strip().lower() == str(correct_val).strip().lower())
            
            status = "CORRECT" if is_correct else "INCORRECT"
            perf_details.append(
                f"Question: {q.get('question')}\n"
                f"Rép. Candidat: {user_val}\n"
                f"Rép. Attendue: {correct_val}\n"
                f"Résultat: {status}\n"
                f"Difficulté: {q.get('difficulty', 'medium')}\n"
            )

        perf_summary = "\n".join(perf_details)

        
        # 3. Candidate Context (CV)
        raw_skills = profile.get("skills") or profile.get("competences") or []
        if isinstance(raw_skills, list):
            skill_names = []
            for skill in raw_skills:
                if isinstance(skill, dict):
                    name = skill.get("name") or skill.get("label") or skill.get("nom") or skill.get("value") or skill.get("skill") or ""
                    if name:
                        skill_names.append(str(name))
                elif skill:
                    skill_names.append(str(skill))
            skills_text = ", ".join(skill_names) if skill_names else "N/A"
        elif raw_skills:
            skills_text = str(raw_skills)
        else:
            skills_text = "N/A"

        title_text = profile.get("title") or profile.get("headline") or profile.get("posteActuel") or profile.get("titre") or "N/A"
        cv_summary = f"Titre: {title_text}\nSkills: {skills_text}"
        
        # 4. Comprehensive & Strong Prompt
        prompt = f"""
Vous êtes un Expert en Recrutement Technique Senior et Analyste en Psychométrie. Votre mission est d'analyser la performance d'un candidat à un quiz technique de manière EXTRÊMEMENT CRITIQUE.

CONTEXTE DU CANDIDAT (CV):
{cv_summary}

CONTEXTE SOURCE (Le matériel de référence sur lequel le quiz est basé):
{chunks_text[:10000]}

RÉSULTATS DÉTAILLÉS DU QUIZ:
{perf_summary}

VOTRE ANALYSE DOIT PORTER SUR :
1. PROFONDEUR TECHNIQUE : Le candidat a-t-il vraiment compris les concepts ou a-t-il simplement deviné ? Comparez ses réponses aux sources.
2. COHÉRENCE CV vs RÉALITÉ : Les compétences démontrées ici valident-elles ou contreflexent-elles le CV ? 
3. DÉTECTION D'INTÉGRITÉ & FRAUDE : 
   - Le candidat a-t-il utilisé des termes exactement identiques à la source (pour les questions ouvertes/fill_in) sans reformulation ?
   - Y a-t-il une incohérence cognitive (réussite insolente sur des questions "hard" mais échec sur des "easy") ?
4. RECOMMANDATION FINALE : Est-ce un profil fiable et techniquement solide ?

Format de sortie : Un SEUL paragraphe synthétique (4-6 sentences max), professionnel, direct et en Français. Pas de salutations, pas de listes.
"""

        try:
            analysis, used_model = await self._generate_with_llm("quiz_analysis", prompt, max_tokens=700, temperature=0.2)
            analysis = (analysis or "Analyse technique non disponible actuellement.").strip()
            logger.info("AI quiz performance analysis generated with model=%s", used_model)
            
            # Remove any introductory phrases if present
            if ":" in analysis[:50]:
                analysis = analysis.split(":", 1)[-1].strip()
                
            return analysis

        except Exception as e:
            logger.error(f"Erreur lors de l'analyse du quiz: {e}")
            return f"Erreur lors de l'analyse IA : {str(e)}"
