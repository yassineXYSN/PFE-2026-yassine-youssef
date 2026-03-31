from database.mongodb import connect_mongodb
from bson import ObjectId

db = connect_mongodb()["HumatiQ"]
iv_id = "69c9a7981e3fcb5cb9e1f2c8"
iv = db.hr_interviews.find_one({"_id": ObjectId(iv_id)})
with open("iv_time_results.txt", "w", encoding="utf-8") as f:
    if iv:
        f.write(f"Start: {iv.get('start_time')}\n")
        f.write(f"End: {iv.get('end_time')}\n")
        f.write(f"Duration: {iv.get('duration')} (type: {type(iv.get('duration'))})\n")
    else:
        f.write("Interview not found\n")
