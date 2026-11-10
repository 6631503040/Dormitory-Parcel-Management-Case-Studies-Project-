-- 0009 — Staff registration by an Admin. Accounts used to come only from the seed tool; an Admin now
-- creates them from the app. created_by records which Admin registered each account (NULL for rows
-- that pre-date this migration, and for the first Admin created with cmd/createadmin).

ALTER TABLE staff ADD COLUMN created_by bigint REFERENCES staff (id);
