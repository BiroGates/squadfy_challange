-- FTS index on knowledgement titles (content is stored in S3)
ALTER TABLE knowledgements
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (to_tsvector('english', title)) STORED;

CREATE INDEX knowledgements_search_idx ON knowledgements USING GIN (search_vector);
