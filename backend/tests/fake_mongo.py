"""
Minimal hand-rolled fake Mongo client/db/collection for tests.

Used only where the real MongoDB container is unreachable in the dev sandbox
(demo 2FA tests). Supports the small subset of PyMongo semantics exercised by
`utils/demo_security.py` and the `/auth/demo/*` endpoints: find_one, find
(with .sort/.limit), insert_one, update_one, update_many, delete_one, and the
`$ne` / `$in` query operators plus `$set` updates.
"""

from types import SimpleNamespace


def _matches(doc, query):
    for key, expected in (query or {}).items():
        actual = doc.get(key)
        if isinstance(expected, dict):
            for op, opval in expected.items():
                if op == "$ne":
                    if actual == opval:
                        return False
                elif op == "$in":
                    if actual not in opval:
                        return False
                else:
                    raise NotImplementedError(f"Unsupported operator {op}")
        else:
            if actual != expected:
                return False
    return True


def _apply_update(doc, update):
    for op, fields in update.items():
        if op == "$set":
            doc.update(fields)
        else:
            raise NotImplementedError(f"Unsupported update operator {op}")


def _apply_projection(doc, projection):
    if not projection:
        return dict(doc)
    excluded = {k for k, v in projection.items() if v == 0}
    included = {k for k, v in projection.items() if v == 1}
    if included:
        return {k: v for k, v in doc.items() if k in included}
    return {k: v for k, v in doc.items() if k not in excluded}


class FakeCursor:
    def __init__(self, docs):
        self._docs = docs

    def sort(self, field, direction=1):
        self._docs = sorted(self._docs, key=lambda d: d.get(field), reverse=(direction < 0))
        return self

    def limit(self, n):
        self._docs = self._docs[:n]
        return self

    def __iter__(self):
        return iter(self._docs)

    def __list__(self):
        return list(self._docs)


class FakeCollection:
    def __init__(self):
        self._docs = []

    def find_one(self, query=None, projection=None):
        for doc in self._docs:
            if _matches(doc, query or {}):
                return _apply_projection(doc, projection)
        return None

    def find(self, query=None, projection=None):
        matched = [_apply_projection(d, projection) for d in self._docs if _matches(d, query or {})]
        return FakeCursor(matched)

    def insert_one(self, doc):
        self._docs.append(dict(doc))
        return SimpleNamespace(inserted_id=doc.get("_id"))

    def update_one(self, query, update):
        for doc in self._docs:
            if _matches(doc, query):
                _apply_update(doc, update)
                return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)

    def update_many(self, query, update):
        count = 0
        for doc in self._docs:
            if _matches(doc, query):
                _apply_update(doc, update)
                count += 1
        return SimpleNamespace(matched_count=count, modified_count=count)

    def delete_one(self, query):
        for i, doc in enumerate(self._docs):
            if _matches(doc, query):
                del self._docs[i]
                return SimpleNamespace(deleted_count=1)
        return SimpleNamespace(deleted_count=0)


class FakeDB:
    def __init__(self):
        self._collections = {}

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        if name not in self._collections:
            self._collections[name] = FakeCollection()
        return self._collections[name]

    def __getitem__(self, name):
        return getattr(self, name)


class FakeMongoClient:
    """Mimics a pymongo MongoClient enough for `client["HumatiQ"]` usage."""

    def __init__(self):
        self._dbs = {}

    def __getitem__(self, name):
        if name not in self._dbs:
            self._dbs[name] = FakeDB()
        return self._dbs[name]
