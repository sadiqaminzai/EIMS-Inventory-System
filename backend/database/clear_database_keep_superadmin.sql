-- SQL Script to Clear EIMS Database
-- This will DELETE ALL DATA and then reseed with only:
-- 1. One superadmin user (superadmin@example.com)
-- 2. One default tenant

-- Step 1: Disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- Step 2: Clear ALL tables completely
TRUNCATE TABLE model_has_permissions;
TRUNCATE TABLE model_has_roles;
TRUNCATE TABLE role_has_permissions;
TRUNCATE TABLE account_transactions;
TRUNCATE TABLE payment_details;
TRUNCATE TABLE payments;
TRUNCATE TABLE order_items;
TRUNCATE TABLE orders;
TRUNCATE TABLE inventory_logs;
TRUNCATE TABLE inventory_batches;
TRUNCATE TABLE products;
TRUNCATE TABLE categories;
TRUNCATE TABLE customers;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE brands;
TRUNCATE TABLE countries;
TRUNCATE TABLE accounts;
TRUNCATE TABLE permissions;
TRUNCATE TABLE roles;
TRUNCATE TABLE users;
TRUNCATE TABLE tenants;
TRUNCATE TABLE module_sequences;
TRUNCATE TABLE personal_access_tokens;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE sessions;
TRUNCATE TABLE backups;
TRUNCATE TABLE backup_settings;

-- Clear cache and jobs tables if they exist
TRUNCATE TABLE IF EXISTS jobs;
TRUNCATE TABLE IF EXISTS job_batches;
TRUNCATE TABLE IF EXISTS failed_jobs;
TRUNCATE TABLE IF EXISTS cache;
TRUNCATE TABLE IF EXISTS cache_locks;

-- Step 3: Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Step 4: Show completion message
SELECT 'Database cleared successfully! Run seeder to populate with default data.' AS Status;
