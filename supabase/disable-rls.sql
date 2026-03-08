-- Disable Row Level Security for all tables (for backend-only access)
ALTER TABLE public.taxi_rent_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxi_rent_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rent_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rent_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.borrow_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_records DISABLE ROW LEVEL SECURITY;

-- Verify RLS status
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

