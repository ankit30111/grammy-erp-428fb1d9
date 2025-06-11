
-- First, update existing production orders to use correct PROD_MM_XX format
UPDATE production_orders 
SET voucher_number = 'PROD_06_01' 
WHERE voucher_number = '06-01';

UPDATE production_orders 
SET voucher_number = 'PROD_06_02' 
WHERE voucher_number = '06-02';

UPDATE production_orders 
SET voucher_number = 'PROD_06_03' 
WHERE voucher_number = '06-03';
