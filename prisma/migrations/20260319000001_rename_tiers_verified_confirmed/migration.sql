-- Rename Tier enum values: COMMUNITY → VERIFIED, MESH_TRUTH → CONFIRMED
-- Rename SourceType enum value: COMMUNITY → AUDITOR
--
-- PostgreSQL does not support renaming enum values directly before v14.
-- This migration uses the ADD + UPDATE + DROP VALUE pattern which works
-- on PostgreSQL 14+ (ALTER TYPE ... RENAME VALUE is also available ≥14).

-- Step 1: Add new Tier values
ALTER TYPE "Tier" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "Tier" ADD VALUE IF NOT EXISTS 'CONFIRMED';

-- Step 2: Migrate existing rows
UPDATE "AccessibilityFact" SET "tier" = 'VERIFIED'  WHERE "tier" = 'COMMUNITY';
UPDATE "AccessibilityFact" SET "tier" = 'CONFIRMED' WHERE "tier" = 'MESH_TRUTH';

-- Step 3: Add new SourceType value
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'AUDITOR';

-- Step 4: Migrate SourceType rows
UPDATE "AccessibilityFact" SET "sourceType" = 'AUDITOR' WHERE "sourceType" = 'COMMUNITY';

-- NOTE: PostgreSQL does not allow removing enum values that have ever been used
-- in committed transactions without recreating the type. The old values
-- (COMMUNITY, MESH_TRUTH) are left in the enum as dead values — they will
-- never be written again by application code. If you need to remove them
-- cleanly, recreate the type after confirming no rows use the old values.
