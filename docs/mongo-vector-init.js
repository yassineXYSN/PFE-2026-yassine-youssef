// Runs once at stack startup via the mongo-init Docker service.
// Creates the Atlas vectorSearch index on quiz_chunks if it doesn't already exist.

const targetDb = db.getSiblingDB("HumatiQ");
const collName  = "quiz_chunks";
const indexName = "quiz_chunks_vector_index";

// Ensure the collection exists (no-op if already present)
targetDb.createCollection(collName);

// Check whether the index already exists to stay idempotent
const existing = targetDb[collName].listSearchIndexes().toArray();
const alreadyExists = existing.some(idx => idx.name === indexName);

if (alreadyExists) {
    print(`[mongo-init] Vector search index '${indexName}' already exists — skipping.`);
} else {
    print(`[mongo-init] Creating vector search index '${indexName}' ...`);
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
