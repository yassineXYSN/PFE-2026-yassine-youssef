from database.mongodb import connect_mongodb
from bson import ObjectId

db = connect_mongodb()["HumatiQ"]
app_id = "69c90c79627d893a5eba3f63"
app = db.job_applications.find_one({"_id": ObjectId(app_id)})
with open("app_results.txt", "w", encoding="utf-8") as f:
    if app:
        f.write(f"Application {app_id}:\n")
        f.write(f"  status: {app.get('status')}\n")
        f.write(f"  interview_id: {app.get('interview_id')} (type: {type(app.get('interview_id'))})\n")
        f.write(f"  interview_status: {app.get('interview_status')} (type: {type(app.get('interview_status'))})\n")
    else:
        f.write(f"Application {app_id} not found.\n")
