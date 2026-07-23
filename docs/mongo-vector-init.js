// Runs once at stack startup via the mongo-init Docker service.
// Creates the Atlas vectorSearch indexes this app depends on, if missing.

const targetDb = db.getSiblingDB("HumatiQ");

function ensureVectorIndex(collName, indexName) {
    targetDb.createCollection(collName);

    const existing = targetDb[collName].getSearchIndexes();
    const alreadyExists = existing.some(idx => idx.name === indexName);

    if (alreadyExists) {
        print(`[mongo-init] Vector search index '${indexName}' on '${collName}' already exists — skipping.`);
        return;
    }

    print(`[mongo-init] Creating vector search index '${indexName}' on '${collName}' ...`);
    targetDb[collName].createSearchIndex({
        name: indexName,
        type: "vectorSearch",
        definition: {
            fields: [
                {
                    type:          "vector",
                    path:          "embedding",
                    numDimensions: 768,   // nomic-embed-text output dimension
                    similarity:    "cosine"
                }
            ]
        }
    });
    print(`[mongo-init] Index '${indexName}' created successfully.`);
}

// Used by services/quiz/retrieval.py for quiz-chunk RAG retrieval.
ensureVectorIndex("quiz_chunks", "quiz_chunks_vector_index");

// Used by services/ai_matching.py for candidate/job matching (Phase 1 filter).
ensureVectorIndex("candidates", "default");
