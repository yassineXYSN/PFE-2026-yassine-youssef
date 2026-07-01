from datetime import datetime, timezone


def sync_account_status(mysql_cursor, mongo_db, user_id: str, status: str) -> None:
    """
    Updates profiles.status in MySQL for `user_id`, then mirrors the same
    status onto whichever MongoDB profile document exists for that _id
    (hr_profiles first, then superadmins as a fallback).
    Caller is responsible for committing the MySQL connection.
    """
    mysql_cursor.execute("UPDATE profiles SET status = %s WHERE id = %s", (status, user_id))

    now = datetime.now(timezone.utc)
    result = mongo_db.hr_profiles.update_one(
        {"_id": user_id},
        {"$set": {"status": status, "updated_at": now}}
    )
    if result.matched_count == 0:
        mongo_db.superadmins.update_one(
            {"_id": user_id},
            {"$set": {"status": status, "updated_at": now}}
        )
