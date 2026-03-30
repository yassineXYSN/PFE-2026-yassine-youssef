from database.mongodb import connect_mongodb
from datetime import datetime

db = connect_mongodb()["HumatiQ"]
docs = list(db.hr_interviews.find({"status": "scheduled"}))
with open("inspect_results.txt", "w", encoding="utf-8") as f:
    f.write(f"Total scheduled interviews: {len(docs)}\n")
    for d in docs:
        f.write(f"ID: {d.get('_id')}\n")
        f.write(f"  Candidate: {d.get('candidate_name')}\n")
        f.write(f"  Start: {d.get('start_time')} (type: {type(d.get('start_time'))})\n")
        f.write(f"  5m sent? {d.get('reminder_5m_sent')}\n")
        
        now = datetime.utcnow()
        start = d.get('start_time')
        if isinstance(start, str):
            try:
                start = datetime.fromisoformat(start.replace("Z", "+00:00")).replace(tzinfo=None)
            except:
                pass
                
        if isinstance(start, datetime):
            delta = start - now
            minutes = delta.total_seconds() / 60
            f.write(f"  Starts in: {minutes:.2f} minutes\n")
        f.write("---\n")
