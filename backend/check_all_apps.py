from database.mongodb import connect_mongodb
from bson import ObjectId

db = connect_mongodb()["HumatiQ"]
target_app_id = "69c90c79627d893a5eba3f63"
target_app = db.job_applications.find_one({"_id": ObjectId(target_app_id)})
with open("all_apps_results.txt", "w", encoding="utf-8") as f:
    if target_app:
        candidate_id = target_app.get("candidate_id") or target_app.get("user_id")
        f.write(f"Candidate ID: {candidate_id}\n")
        apps = list(db.job_applications.find({"candidate_id": candidate_id}))
        f.write(f"Found {len(apps)} applications:\n")
        for a in apps:
            f.write(f"ID: {a['_id']}\n")
            f.write(f"  status: [{a.get('status')}]\n")
            f.write(f"  interview_status: {a.get('interview_status')}\n")
            f.write(f"  interview_id: {a.get('interview_id')}\n")
            f.write("---\n")
    else:
        f.write("Target app not found\n")
