-- ============================================
-- MEJWANI RESTAURANT MANAGEMENT SYSTEM
-- Sample Data File - MySQL
-- ============================================
-- Run: mysql -u root -pSatara@123 mejwani_db < mejwani_sample_data.sql
-- ============================================

USE mejwani_db;

-- ============================================
-- 1. HOTELS (Restaurant / Hotel)
-- ============================================
-- Hotel 3 = Yash Restaurant (main test hotel)
UPDATE hotels SET 
    name = 'Yash Restaurant',
    owner_name = 'Yash Pawar',
    address = 'Main Road, Satara, Maharashtra',
    phone = '9876543210',
    email = 'info@yashrestaurant.com',
    plan = 'Standard',
    status = 'active'
WHERE id = 3;

-- ============================================
-- 2. MENU CATEGORIES (Hotel ID = 3 = Yash)
-- ============================================
INSERT INTO menu_categories (name, name_hindi, display_order, hotel_id) VALUES
('VEG STARTER',        'वेज स्टार्टर',        1, 3),
('NON-VEG STARTER',    'नॉन-वेज स्टार्टर',    2, 3),
('VEG MAIN COURSE',    'वेज मेन कोर्स',       3, 3),
('NON-VEG MAIN COURSE','नॉन-वेज मेन कोर्स',  4, 3),
('CHINESE STARTER',    'चायनीज स्टार्टर',     5, 3),
('SOUP',               'सूप',                  6, 3),
('BREAD',              'ब्रेड',               7, 3),
('RICE & BIRYANI',     'राईस आणि बिर्याणी',   8, 3),
('BEVERAGES',          'बेव्हरेजेस',          9, 3),
('DESSERTS',           'डेझर्ट्स',           10, 3);

-- ============================================
-- 3. MENU ITEMS (Hotel ID = 3)
-- Categories:
--   VEG STARTER       = 1st inserted (id auto)
--   NON-VEG STARTER   = 2nd
--   VEG MAIN COURSE   = 3rd
--   NON-VEG MAIN COURSE = 4th
--   CHINESE STARTER   = 5th
--   SOUP              = 6th
--   BREAD             = 7th
--   RICE & BIRYANI    = 8th
--   BEVERAGES         = 9th
--   DESSERTS          = 10th
-- ============================================

-- Get category IDs dynamically using subqueries
-- VEG STARTERS
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Paneer Tikka', 'पनीर टिक्का', 220.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='VEG STARTER' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Hara Bhara Kabab', 'हरा भरा कबाब', 180.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='VEG STARTER' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Veg Seekh Kabab', 'वेज सीख कबाब', 200.00, 'SINGLE', 1, 1, 3, 3, id FROM menu_categories WHERE name='VEG STARTER' AND hotel_id=3 LIMIT 1;

-- NON-VEG STARTERS
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Chicken Tikka', 'चिकन टिक्का', 280.00, 'SINGLE', 0, 1, 1, 3, id FROM menu_categories WHERE name='NON-VEG STARTER' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Mutton Seekh Kabab', 'मटण सीख कबाब', 350.00, 'SINGLE', 0, 1, 2, 3, id FROM menu_categories WHERE name='NON-VEG STARTER' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Tandoori Chicken', 'तंदूरी चिकन', 320.00, 'HALF_FULL', 0, 1, 3, 3, id FROM menu_categories WHERE name='NON-VEG STARTER' AND hotel_id=3 LIMIT 1;

UPDATE menu_items SET half_price = 180.00, full_price = 320.00 WHERE name='Tandoori Chicken' AND hotel_id=3;

-- VEG MAIN COURSE
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Paneer Butter Masala', 'पनीर बटर मसाला', 280.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Dal Tadka', 'दाल तडका', 180.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Mix Veg Curry', 'मिक्स वेज करी', 200.00, 'SINGLE', 1, 1, 3, 3, id FROM menu_categories WHERE name='VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Shahi Paneer', 'शाही पनीर', 300.00, 'SINGLE', 1, 1, 4, 3, id FROM menu_categories WHERE name='VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

-- NON-VEG MAIN COURSE
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Chicken Masala', 'चिकन मसाला', 320.00, 'HALF_FULL', 0, 1, 1, 3, id FROM menu_categories WHERE name='NON-VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

UPDATE menu_items SET half_price = 180.00, full_price = 320.00 WHERE name='Chicken Masala' AND hotel_id=3;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Mutton Rogan Josh', 'मटण रोगन जोश', 420.00, 'SINGLE', 0, 1, 2, 3, id FROM menu_categories WHERE name='NON-VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Fish Curry', 'मासे करी', 380.00, 'SINGLE', 0, 1, 3, 3, id FROM menu_categories WHERE name='NON-VEG MAIN COURSE' AND hotel_id=3 LIMIT 1;

-- SOUPS
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Tomato Soup', 'टोमॅटो सूप', 120.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='SOUP' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Manchow Soup', 'मंचाव सूप', 140.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='SOUP' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Chicken Soup', 'चिकन सूप', 160.00, 'SINGLE', 0, 1, 3, 3, id FROM menu_categories WHERE name='SOUP' AND hotel_id=3 LIMIT 1;

-- BREAD
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Butter Naan', 'बटर नान', 60.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='BREAD' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Tandoori Roti', 'तंदूरी रोटी', 40.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='BREAD' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Laccha Paratha', 'लच्छा पराठा', 70.00, 'SINGLE', 1, 1, 3, 3, id FROM menu_categories WHERE name='BREAD' AND hotel_id=3 LIMIT 1;

-- RICE & BIRYANI
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Veg Biryani', 'वेज बिर्याणी', 220.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='RICE & BIRYANI' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Chicken Biryani', 'चिकन बिर्याणी', 300.00, 'HALF_FULL', 0, 1, 2, 3, id FROM menu_categories WHERE name='RICE & BIRYANI' AND hotel_id=3 LIMIT 1;

UPDATE menu_items SET half_price = 180.00, full_price = 300.00 WHERE name='Chicken Biryani' AND hotel_id=3;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Jeera Rice', 'जीरा राईस', 150.00, 'SINGLE', 1, 1, 3, 3, id FROM menu_categories WHERE name='RICE & BIRYANI' AND hotel_id=3 LIMIT 1;

-- BEVERAGES
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Cold Drink', 'कोल्ड ड्रिंक', 60.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='BEVERAGES' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Lassi', 'लस्सी', 80.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='BEVERAGES' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Mineral Water', 'मिनरल वॉटर', 30.00, 'SINGLE', 1, 1, 3, 3, id FROM menu_categories WHERE name='BEVERAGES' AND hotel_id=3 LIMIT 1;

-- DESSERTS
INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Gulab Jamun', 'गुलाब जामुन', 80.00, 'SINGLE', 1, 1, 1, 3, id FROM menu_categories WHERE name='DESSERTS' AND hotel_id=3 LIMIT 1;

INSERT INTO menu_items (name, name_hindi, price, pricing_type, is_veg, is_available, display_order, hotel_id, category_id)
SELECT 'Ice Cream', 'आईस क्रीम', 100.00, 'SINGLE', 1, 1, 2, 3, id FROM menu_categories WHERE name='DESSERTS' AND hotel_id=3 LIMIT 1;

-- ============================================
-- 4. SECTIONS for Hotel 3 (Yash)
-- ============================================
-- Already have id=1 "Main Hall"
-- Add more if needed:
INSERT IGNORE INTO sections (id, section_name, hotel_id) VALUES
(1, 'Main Hall', 3);

-- ============================================
-- 5. RESTAURANT TABLES for Hotel 3
-- ============================================
INSERT INTO restaurant_tables (table_name, hotel_id, section_id, status) VALUES
('Table 1', 3, 1, 'AVAILABLE'),
('Table 2', 3, 1, 'AVAILABLE'),
('Table 3', 3, 1, 'AVAILABLE'),
('Table 4', 3, 1, 'AVAILABLE'),
('Table 5', 3, 1, 'AVAILABLE'),
('Table 6', 3, 1, 'AVAILABLE');

-- ============================================
-- 6. STAFF for Hotel 3
-- Password = 'password' (bcrypt hash)
-- ============================================
INSERT INTO staff (name, phone, role, salary, is_active, hotel_id) VALUES
('Rahul Captain', '9876543211', 'CAPTAIN', 15000.00, 1, 3),
('Suresh Waiter', '9876543212', 'WAITER', 10000.00, 1, 3),
('Ramesh Chef', '9876543213', 'CHEF', 20000.00, 1, 3);

-- ============================================
-- VERIFY DATA
-- ============================================
SELECT 'Hotels:' as '', COUNT(*) FROM hotels;
SELECT 'Menu Categories:' as '', COUNT(*) FROM menu_categories WHERE hotel_id=3;
SELECT 'Menu Items:' as '', COUNT(*) FROM menu_items WHERE hotel_id=3;
SELECT 'Sections:' as '', COUNT(*) FROM sections WHERE hotel_id=3;
SELECT 'Tables:' as '', COUNT(*) FROM restaurant_tables WHERE hotel_id=3;
SELECT 'Staff:' as '', COUNT(*) FROM staff WHERE hotel_id=3;
