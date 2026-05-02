-- Reset all auto-increment sequences to prevent unique constraint violations
-- Find and reset all sequences associated with auto-increment columns
DO $$
DECLARE seq RECORD;
BEGIN FOR seq IN
SELECT sequence_name
FROM information_schema.sequences
WHERE sequence_schema = 'public' LOOP -- Reset each sequence to the max ID + 1 of its associated table
    EXECUTE 'SELECT SETVAL(' || quote_literal(seq.sequence_name) || ', COALESCE(MAX(CAST(last_value AS INTEGER)), 0) + 1) FROM ' || quote_ident(seq.sequence_name) || ';';
END LOOP;
END $$;