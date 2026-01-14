-- 1. Insert Global Categories (User ID is NULL)
-- These will be available to ALL users
INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Food', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Food');

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Transport', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transport');

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Utilities', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Utilities');

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Entertainment', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Entertainment');

INSERT INTO categories (name, user_id, created_at, updated_at)
SELECT 'Health', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Health');