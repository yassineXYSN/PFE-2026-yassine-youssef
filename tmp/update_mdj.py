"""
Implements the HumatiQ_ClassDiagram.puml into Conception HumatiQ.mdj
"""
import json
import base64
import os

MDJ_PATH = os.path.join(os.path.dirname(__file__), "Diagrammes", "UML", "Conception HumatiQ.mdj")

# ── ID generation ───────────────────────────────────────────────────────────
_counter = [0]
def new_id(label=""):
    _counter[0] += 1
    raw = f"HumatiQ{label}{_counter[0]:04d}"
    raw_bytes = raw.encode()[:15].ljust(15, b'\x00')
    return base64.b64encode(raw_bytes).decode()

# ── Element factories ────────────────────────────────────────────────────────
def make_attr(parent_id, name, typ=""):
    return {"_type": "UMLAttribute", "_id": new_id("attr"),
            "_parent": {"$ref": parent_id}, "name": name, "type": typ,
            "visibility": "public"}

def make_op(parent_id, name):
    return {"_type": "UMLOperation", "_id": new_id("op"),
            "_parent": {"$ref": parent_id}, "name": name, "visibility": "public"}

def make_assoc(parent_id, name, src_id, src_mult, dst_id, dst_mult,
               src_agg="none", dst_agg="none"):
    aid = new_id("assoc")
    return {
        "_type": "UMLAssociation", "_id": aid,
        "_parent": {"$ref": parent_id}, "name": name,
        "end1": {"_type": "UMLAssociationEnd", "_id": new_id("end"),
                 "_parent": {"$ref": aid}, "reference": {"$ref": src_id},
                 "multiplicity": src_mult, "aggregation": src_agg, "navigable": True},
        "end2": {"_type": "UMLAssociationEnd", "_id": new_id("end"),
                 "_parent": {"$ref": aid}, "reference": {"$ref": dst_id},
                 "multiplicity": dst_mult, "aggregation": dst_agg, "navigable": True},
    }

def build_class(class_id, model_id, name, is_abstract=False):
    return {"_type": "UMLClass", "_id": class_id, "_parent": {"$ref": model_id},
            "name": name, "isAbstract": is_abstract, "attributes": [], "operations": []}

def ensure_attrs(cls, attrs):
    existing = {a["name"] for a in cls.get("attributes", [])}
    cls.setdefault("attributes", [])
    for name, typ in attrs:
        if name not in existing:
            cls["attributes"].append(make_attr(cls["_id"], name, typ))

def ensure_ops(cls, ops):
    existing = {o["name"] for o in cls.get("operations", [])}
    cls.setdefault("operations", [])
    for name in ops:
        if name not in existing:
            cls["operations"].append(make_op(cls["_id"], name))

# ── View factories ────────────────────────────────────────────────────────────
def make_label(parent_id, visible, left, top, text="", width=None, bold=False, align=None):
    lv = {"_type": "LabelView", "_id": new_id("lv"), "_parent": {"$ref": parent_id},
          "font": f"Arial;18;{'1' if bold else '0'}", "parentStyle": True,
          "left": left, "top": top, "height": 18}
    if not visible: lv["visible"] = False
    if text: lv["text"] = text
    if width is not None: lv["width"] = width
    if align is not None: lv["horizontalAlignment"] = align
    return lv

def make_class_view(diagram_id, class_id, class_name, left, top, width,
                    attr_ids_texts, op_ids_texts):
    vid = new_id("cv")
    nc_id = new_id("nc")
    ac_id = new_id("ac")
    oc_id = new_id("oc")

    nc_h = 46
    ac_h = max(10, len(attr_ids_texts) * 18 + 4)
    oc_h = max(10, len(op_ids_texts) * 18 + 4)

    # name-compartment sub-views
    nc_sub = [
        make_label(nc_id, False, left+4, top+2),
        make_label(nc_id, True,  left+4, top+20, class_name, width-8, bold=True),
        make_label(nc_id, False, left+4, top+40, "(from Model)", 102),
        make_label(nc_id, False, left+4, top+60, align=1),
    ]
    nc_view = {"_type": "UMLNameCompartmentView", "_id": nc_id,
               "_parent": {"$ref": vid}, "model": {"$ref": class_id},
               "subViews": nc_sub, "font": "Arial;18;0", "parentStyle": True,
               "left": left, "top": top, "width": width, "height": nc_h,
               "horizontalAlignment": 2}

    # attribute compartment
    ac_sub = []
    y = top + nc_h + 2
    for mid, txt in attr_ids_texts:
        ac_sub.append({"_type": "UMLAttributeView", "_id": new_id("av"),
                       "_parent": {"$ref": ac_id}, "model": {"$ref": mid},
                       "font": "Arial;18;0", "parentStyle": True,
                       "left": left+4, "top": y, "width": width-8, "height": 18,
                       "text": txt})
        y += 18
    ac_view = {"_type": "UMLAttributeCompartmentView", "_id": ac_id,
               "_parent": {"$ref": vid}, "model": {"$ref": class_id},
               "subViews": ac_sub, "font": "Arial;18;0", "parentStyle": True,
               "left": left, "top": top + nc_h, "width": width, "height": ac_h}

    # operation compartment
    oc_sub = []
    y = top + nc_h + ac_h + 2
    for mid, txt in op_ids_texts:
        oc_sub.append({"_type": "UMLOperationView", "_id": new_id("ov"),
                       "_parent": {"$ref": oc_id}, "model": {"$ref": mid},
                       "font": "Arial;18;0", "parentStyle": True,
                       "left": left+4, "top": y, "width": width-8, "height": 18,
                       "text": txt})
        y += 18
    oc_view = {"_type": "UMLOperationCompartmentView", "_id": oc_id,
               "_parent": {"$ref": vid}, "model": {"$ref": class_id},
               "subViews": oc_sub, "font": "Arial;18;0", "parentStyle": True,
               "left": left, "top": top + nc_h + ac_h, "width": width,
               "height": oc_h}

    total_h = nc_h + ac_h + oc_h
    return {"_type": "UMLClassView", "_id": vid, "_parent": {"$ref": diagram_id},
            "model": {"$ref": class_id}, "subViews": [nc_view, ac_view, oc_view],
            "font": "Arial;18;0", "fillColor": "#FFFFFF", "lineColor": "#000000",
            "left": left, "top": top, "width": width, "height": total_h}

def make_assoc_view(diagram_id, assoc_id, src_view_id, tgt_view_id):
    return {"_type": "UMLAssociationView", "_id": new_id("assview"),
            "_parent": {"$ref": diagram_id}, "model": {"$ref": assoc_id},
            "subViews": [], "source": {"$ref": src_view_id},
            "target": {"$ref": tgt_view_id}, "lineStyle": 0,
            "font": "Arial;18;0", "fillColor": "#FFFFFF", "lineColor": "#000000"}

# ═══════════════════════════════════════════════════════════════════════════════
#  LOAD
# ═══════════════════════════════════════════════════════════════════════════════
with open(MDJ_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)

model_elem = data["ownedElements"][0]
model_id   = model_elem["_id"]
diagram    = model_elem["ownedElements"][0]
diagram_id = diagram["_id"]

# ── helper: get class by name ─────────────────────────────────────────────────
def get_class(name):
    for e in model_elem["ownedElements"]:
        if e.get("_type") == "UMLClass" and e.get("name") == name:
            return e
    return None

def get_class_view_id(class_id):
    for v in diagram["ownedViews"]:
        if v.get("_type") == "UMLClassView" and v.get("model", {}).get("$ref") == class_id:
            return v["_id"]
    return None

# ── Known IDs ─────────────────────────────────────────────────────────────────
ID = {
    "Utilisateur":            "AAAAAAGeMVTK5r98ehE=",
    "SuperAdministrateur":    "AAAAAAGeMVX/4b/KHeE=",
    "UtilisateurRH":          "AAAAAAGeMVYDPb/zj1A=",
    "Candidat":               "AAAAAAGeMVYGHcAc6eQ=",
    "Admin":                  "AAAAAAGeMVYTaMBFXWg=",
    "ChefDepartement":        "AAAAAAGeMVYWpsBugKA=",
    "Recruteur":              "AAAAAAGeMVYZWMCXTio=",
    "Entreprise":             "AAAAAAGeMVkpccGLkHo=",
    "Departement":            "AAAAAAGeMVnx98HMelg=",
    "OffreEmploi":            "AAAAAAHhmatiQOffre01=",
    "Candidature":            "AAAAAAHhmatiQCandid1=",
    "Quiz":                   "AAAAAAHhmatiQQuiz001=",
    "Entretien":              "AAAAAAHhmatiQEntret1=",
    "Notification":           new_id("Notif"),
    "Document":               new_id("Docum"),
    "ConfigAutomatisationIA": new_id("CfgAI"),
}

# ══════════════════════════════════════════════════════════════════════════════
#  1. UPDATE EXISTING CLASSES
# ══════════════════════════════════════════════════════════════════════════════

# Utilisateur
u = get_class("Utilisateur")
u["isAbstract"] = True
for a in u.get("attributes", []):
    if a["name"] == "String Email":    a["name"] = "String email"
    if a["name"] == "String Password": a["name"] = "String motDePasse"
ensure_attrs(u, [("String statut", "String")])

# SuperAdministrateur
sa = get_class("SuperAdministrateur")
ensure_ops(sa, ["GererPlateforme"])

# UtilisateurRH
urh = get_class("UtilisateurRH")
urh["isAbstract"] = True
for a in urh.get("attributes", []):
    if a["name"] == "String Role": a["name"] = "String role"
ensure_attrs(urh, [("String companyId", "String")])

# Admin
adm = get_class("Admin")
ensure_ops(adm, ["GererUtilisateursRH", "CreerOffre", "SupprimerOffre",
                 "GererDepartements", "ConsulterTableauBord"])

# ChefDepartement (was "Chef de departement")
chef = get_class("Chef de departement")
chef["name"] = "ChefDepartement"
ensure_attrs(chef, [("String departementId", "String")])
ensure_ops(chef, ["SuivreOffres", "ConsulterCandidatures",
                  "ValiderCandidatures", "GererEquipe"])

# Recruteur
rec = get_class("Recruteur")
ensure_ops(rec, ["[IA] SuggererCandidats", "[IA] ScorerCandidatsLLM",
                 "[IA] LancerAutomatisation", "[IA] GenererQuiz"])

# Candidat
can = get_class("Candidat")
for o in can.get("operations", []):
    if o["name"] == "PaserCV":          o["name"] = "ParserCV"
    if o["name"] == "ConfigurerProfile": o["name"] = "ConfigurerProfil"
    if o["name"] == "ModifierProfile":   o["name"] = "ModifierProfil"
ensure_attrs(can, [("List competences", "List"), ("List experiences", "List"),
                   ("List formations", "List"), ("Float forceProfil", "Float"),
                   ("List embedding", "List")])
ensure_ops(can, ["SoumettreCandidat", "SuivreCandidatures",
                 "SauvegarderOffre", "[IA] GenererEmbedding"])

# Entreprise
ent = get_class("Entreprise")
ent["attributes"] = [a for a in ent.get("attributes", [])
                     if a["name"] != "Dict ProfileEntreprise"]
for a in ent.get("attributes", []):
    if a["name"] == "String Nom":    a["name"] = "String nom"
    if a["name"] == "String Secteur": a["name"] = "String secteur"
    if a["name"] == "String Statut":  a["name"] = "String statut"
ensure_attrs(ent, [("UUID id", "UUID"), ("String siret", "String"),
                   ("Boolean onboardingTermine", "Boolean"), ("String logoUrl", "String")])
ent["operations"] = [o for o in ent.get("operations", []) if o["name"] != "GererRecrutement"]
for o in ent.get("operations", []):
    if o["name"] == "ConfigurerProfile": o["name"] = "ConfigurerProfil"
    if o["name"] == "ModifierProfile":   o["name"] = "ModifierProfil"

# Departement
dep = get_class("Departement")
for a in dep.get("attributes", []):
    if a["name"] == "String NomDepartement": a["name"] = "String nom"
ensure_attrs(dep, [("String managerId", "String"), ("String statut", "String")])

# OffreEmploi
off = get_class("OffreEmploi")
ensure_attrs(off, [("String lieuTravail", "String"), ("String niveauExperience", "String"),
                   ("String modeTravail", "String"), ("List competencesRequises", "List"),
                   ("List embedding", "List")])
ensure_ops(off, ["[IA] GenererEmbedding", "[IA] ConfigurerAutomatisation"])

# Candidature
cand = get_class("Candidature")
ensure_attrs(cand, [("String lettreMotivation", "String"), ("Int scoreIA", "Int"),
                    ("String justificationIA", "String"), ("Float scoreEmbedding", "Float"),
                    ("Float scoreLLM", "Float"), ("Float scoreCNN", "Float"),
                    ("Float scoreQuiz", "Float")])
ensure_ops(cand, ["[IA] EvaluerParEmbedding", "[IA] EvaluerParLLM", "[IA] EvaluerParCNN"])

# Entretien
etr = get_class("Entretien")
ensure_attrs(etr, [("String meetingLink", "String"), ("Dict analyseIA", "Dict"),
                   ("List transcription", "List"), ("List historiqueEmotions", "List")])
etr["operations"] = [o for o in etr.get("operations", []) if o["name"] != "ModifierEntretien"]
ensure_ops(etr, ["[IA] AnalyserEmotions", "[IA] TranscrireParole", "[IA] GenererAnalyseIA"])

# Quiz
qz = get_class("Quiz")
qz["attributes"] = [a for a in qz.get("attributes", [])
                    if a["name"] != "Integer NombreQuestions"]
ensure_attrs(qz, [("String statut", "String"), ("Float score", "Float"),
                  ("Dict repartitionDifficulte", "Dict"), ("List questions", "List")])
qz["operations"] = [o for o in qz.get("operations", [])
                    if o["name"] not in ("CreerQuiz", "ModifierQuiz")]
ensure_ops(qz, ["[IA] Generer", "[IA] GenererQuestion", "Publier",
                "Demarrer", "SoumettreReponses", "[IA] CalculerScore"])

# ══════════════════════════════════════════════════════════════════════════════
#  2. ADD NEW CLASSES
# ══════════════════════════════════════════════════════════════════════════════

notif_cls = build_class(ID["Notification"], model_id, "Notification")
ensure_attrs(notif_cls, [("UUID id","UUID"),("String type","String"),
                          ("String categorie","String"),("String titre","String"),
                          ("String message","String"),("Boolean estLue","Boolean")])
ensure_ops(notif_cls, ["Envoyer", "MarquerCommeLue"])
model_elem["ownedElements"].append(notif_cls)

doc_cls = build_class(ID["Document"], model_id, "Document")
ensure_attrs(doc_cls, [("UUID id","UUID"),("String titre","String"),
                        ("String typeFichier","String"),("String statut","String"),
                        ("Int totalChunks","Int"),("Int totalTokens","Int")])
ensure_ops(doc_cls, ["Telecharger","Decouper","[IA] GenererEmbeddings","[IA] ExtraireTexte"])
model_elem["ownedElements"].append(doc_cls)

cfg_cls = build_class(ID["ConfigAutomatisationIA"], model_id, "ConfigAutomatisationIA")
ensure_attrs(cfg_cls, [("Boolean activee","Boolean"),
                        ("String modeDeclenchement","String"),
                        ("Int filtrageVecteur","Int"),("Int filtrageLLM","Int"),
                        ("Int stageQuiz","Int"),("Boolean executionActivee","Boolean")])
ensure_ops(cfg_cls, ["[IA] Executer","[IA] FiltrerParVecteur",
                      "[IA] FiltrerParLLM","[IA] EnvoyerQuizAuto"])
model_elem["ownedElements"].append(cfg_cls)

# ══════════════════════════════════════════════════════════════════════════════
#  3. FIX EXISTING ASSOCIATIONS
# ══════════════════════════════════════════════════════════════════════════════
for elem in model_elem["ownedElements"]:
    if elem.get("_type") != "UMLAssociation":
        continue
    n = elem.get("name", "")
    if n == "possede":
        elem["end1"]["multiplicity"] = "1"
        elem["end2"]["multiplicity"] = "1..*"
        elem["end1"]["aggregation"] = "composite"
    elif n == "gere":       # Departement->OffreEmploi, rename to supervise
        elem["name"] = "supervise"
        elem["end1"]["multiplicity"] = "1"
        elem["end2"]["multiplicity"] = "0..*"
    elif n == "publie":
        elem["end1"]["multiplicity"] = "1"; elem["end2"]["multiplicity"] = "0..*"
    elif n == "soumet":
        elem["end1"]["multiplicity"] = "1"; elem["end2"]["multiplicity"] = "0..*"
    elif n == "recoit":
        elem["end1"]["multiplicity"] = "1"; elem["end2"]["multiplicity"] = "0..*"
    elif n == "genere":
        elem["end1"]["multiplicity"] = "1"; elem["end2"]["multiplicity"] = "0..*"
    elif n == "conduit":
        elem["end1"]["multiplicity"] = "1"; elem["end2"]["multiplicity"] = "0..*"
    elif n == "associeA":   # repurpose to OffreEmploi *-- ConfigAutomatisationIA
        elem["name"] = "configure"
        elem["end1"]["reference"]["$ref"] = ID["OffreEmploi"]
        elem["end2"]["reference"]["$ref"] = ID["ConfigAutomatisationIA"]
        elem["end1"]["multiplicity"] = "1"
        elem["end2"]["multiplicity"] = "0..1"
        elem["end1"]["aggregation"] = "composite"

# ══════════════════════════════════════════════════════════════════════════════
#  4. ADD NEW ASSOCIATIONS
# ══════════════════════════════════════════════════════════════════════════════
new_assocs = [
    make_assoc(model_id, "cree",
               ID["SuperAdministrateur"], "1", ID["Entreprise"], "1..*"),
    make_assoc(model_id, "emploie",
               ID["Entreprise"], "1", ID["UtilisateurRH"], "1..*",
               dst_agg="shared"),
    make_assoc(model_id, "gere",
               ID["ChefDepartement"], "0..1", ID["Departement"], "1"),
    make_assoc(model_id, "creeOffre",
               ID["Admin"], "1", ID["OffreEmploi"], "0..*"),
    make_assoc(model_id, "genereQuiz",
               ID["Document"], "1", ID["Quiz"], "0..*"),
    make_assoc(model_id, "evalueePar",
               ID["Candidature"], "0..1", ID["Quiz"], "0..1"),
    make_assoc(model_id, "recoit",
               ID["Utilisateur"], "1", ID["Notification"], "0..*"),
]
for a in new_assocs:
    model_elem["ownedElements"].append(a)

# ══════════════════════════════════════════════════════════════════════════════
#  5. ADD DIAGRAM VIEWS FOR NEW CLASSES
# ══════════════════════════════════════════════════════════════════════════════
LAYOUT = {
    "Notification":           (700, 189,  240),
    "Document":               (1200, 896, 250),
    "ConfigAutomatisationIA": (1050, 1140, 250),
}

for cls_obj in [notif_cls, doc_cls, cfg_cls]:
    left, top, w = LAYOUT[cls_obj["name"]]
    attrs = [(a["_id"], a["name"]) for a in cls_obj.get("attributes", [])]
    ops   = [(o["_id"], o["name"]) for o in cls_obj.get("operations", [])]
    cv = make_class_view(diagram_id, cls_obj["_id"], cls_obj["name"],
                         left, top, w, attrs, ops)
    diagram["ownedViews"].append(cv)

# ══════════════════════════════════════════════════════════════════════════════
#  6. ADD ASSOCIATION VIEWS FOR NEW ASSOCIATIONS
# ══════════════════════════════════════════════════════════════════════════════
# Rebuild class_view_map after adding new views
class_view_map = {}
for v in diagram["ownedViews"]:
    if v.get("_type") == "UMLClassView":
        class_view_map[v["model"]["$ref"]] = v["_id"]

assoc_view_pairs = [
    (new_assocs[0], ID["SuperAdministrateur"], ID["Entreprise"]),   # cree
    (new_assocs[1], ID["Entreprise"],          ID["UtilisateurRH"]),# emploie
    (new_assocs[2], ID["ChefDepartement"],     ID["Departement"]),  # gere
    (new_assocs[3], ID["Admin"],               ID["OffreEmploi"]),  # creeOffre
    (new_assocs[4], ID["Document"],            ID["Quiz"]),          # genereQuiz
    (new_assocs[5], ID["Candidature"],         ID["Quiz"]),          # evalueePar
    (new_assocs[6], ID["Utilisateur"],         ID["Notification"]),  # recoit
]
for assoc, src, tgt in assoc_view_pairs:
    sv = class_view_map.get(src)
    tv = class_view_map.get(tgt)
    if sv and tv:
        diagram["ownedViews"].append(make_assoc_view(diagram_id, assoc["_id"], sv, tv))

# Also add view for the repurposed "configure" association
cfg_assoc = next((e for e in model_elem["ownedElements"]
                  if e.get("_type") == "UMLAssociation" and e.get("name") == "configure"), None)
if cfg_assoc:
    sv = class_view_map.get(ID["OffreEmploi"])
    tv = class_view_map.get(ID["ConfigAutomatisationIA"])
    if sv and tv:
        diagram["ownedViews"].append(make_assoc_view(diagram_id, cfg_assoc["_id"], sv, tv))

# ══════════════════════════════════════════════════════════════════════════════
#  SAVE
# ══════════════════════════════════════════════════════════════════════════════
with open(MDJ_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent="\t")

classes_count  = sum(1 for e in model_elem["ownedElements"] if e.get("_type") == "UMLClass")
assocs_count   = sum(1 for e in model_elem["ownedElements"] if e.get("_type") == "UMLAssociation")
views_count    = len(diagram["ownedViews"])
print("Done! MDJ updated.")
print(f"  Classes:      {classes_count}")
print(f"  Associations: {assocs_count}")
print(f"  Diagram views:{views_count}")
