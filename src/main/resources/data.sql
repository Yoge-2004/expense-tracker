-- 1. Insert Global Categories (User ID is NULL)
-- These will be available to ALL users

-- Baseline Legacy Categories
INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Food', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Food' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Transport', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transport' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Utilities', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Utilities' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Entertainment', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Entertainment' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Health', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Health' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Shopping', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Shopping' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Finance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Finance' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Savings', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Savings' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Loan', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Loan' AND user_id IS NULL);

-- Canonical ML Taxonomy Categories
INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Food & Dining', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Food & Dining' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Transportation', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transportation' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Shopping & Retail', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Shopping & Retail' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Entertainment & Recreation', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Entertainment & Recreation' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Healthcare & Medical', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Healthcare & Medical' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Utilities & Services', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Utilities & Services' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Financial Services', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Financial Services' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Income', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Income' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Government & Legal', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Government & Legal' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Charity & Donations', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Charity & Donations' AND user_id IS NULL);

-- Extended Financial Taxonomy Categories
INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Housing', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Housing' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Groceries', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Groceries' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Education', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Education' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Personal Care', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Personal Care' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Travel', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Travel' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Insurance', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Insurance' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Investments', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Investments' AND user_id IS NULL);

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'General', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'General' AND user_id IS NULL);