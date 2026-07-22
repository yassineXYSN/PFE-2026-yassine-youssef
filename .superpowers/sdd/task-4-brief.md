## Task 4: `manual_candidates` router — DELETE /staged/{staged_id}

**Files:**
- Modify: `backend/routers/manual_candidates.py`
- Test: `backend/tests/test_manual_candidates.py`

**Interfaces:**
- Consumes: `_ensure_job_access`, `_delete_staged_file` from Task 3.
- Produces: `DELETE /api/manual-candidates/staged/{staged_id}` → `{ok: true}` or `{ok: true, already_removed: true}`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/test_manual_candidates.py`:

```python
def test_discard_staged_removes_file_and_doc(monkeypatch):
    monkeypatch.setenv("FAKE_ANALYSIS", "1")
    job_id = _make_job()
    try:
        app.dependency_overrides[get_current_user] = _as("hr")
        files = {"cv": ("resume.pdf", b"%PDF fake resume content", "application/pdf")}
        r = client.post("/api/manual-candidates/parse", data={"job_id": job_id}, files=files)
        staged_id = r.json()["staged_id"]

        db = _db()
        staged = db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
        abs_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            staged["file_path"].replace("/", os.sep),
        )
        assert os.path.isfile(abs_path)

        del_r = client.delete(f"/api/manual-candidates/staged/{staged_id}")
        assert del_r.status_code == 200
        assert del_r.json()["ok"] is True
        assert db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)}) is None
        assert not os.path.isfile(abs_path)

        # Deleting again is a safe no-op
        del_r2 = client.delete(f"/api/manual-candidates/staged/{staged_id}")
        assert del_r2.status_code == 200
        assert del_r2.json().get("already_removed") is True
    finally:
        app.dependency_overrides.clear()
        _cleanup_job(job_id)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py::test_discard_staged_removes_file_and_doc -v`
Expected: FAIL with 404 (route doesn't exist)

- [ ] **Step 3: Add the endpoint**

In `backend/routers/manual_candidates.py`, append after `parse_manual_candidate_cv`:

```python
@router.delete("/staged/{staged_id}")
async def discard_staged_manual_candidate(
    staged_id: str,
    current_user: dict = Depends(require_roles(HR_SIDE_ROLES)),
):
    """Best-effort cleanup when HR discards a candidate during review."""
    if not ObjectId.is_valid(staged_id):
        raise HTTPException(status_code=400, detail="Invalid staged_id")

    db = get_async_db()
    staged = await db.hr_manual_cv_staging.find_one({"_id": ObjectId(staged_id)})
    if not staged:
        return {"ok": True, "already_removed": True}

    if current_user.get("role") != "superadmin" and staged.get("company_id") != current_user.get("company_id"):
        raise HTTPException(status_code=403, detail="Not authorized to discard this staged CV")

    _delete_staged_file(staged.get("file_path"))
    await db.hr_manual_cv_staging.delete_one({"_id": ObjectId(staged_id)})
    return {"ok": True}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && venv\Scripts\python -m pytest tests/test_manual_candidates.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/routers/manual_candidates.py backend/tests/test_manual_candidates.py
git commit -m "feat(backend): add DELETE /manual-candidates/staged/{id} endpoint"
```

---

