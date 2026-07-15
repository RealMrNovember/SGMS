-- 2026-06-30'daki `20260630180000_add_expense_models` migrasyonu production'da bir kez
-- başarısız olmuş (started_at var, finished_at yok — bkz. _prisma_migrations), ardından
-- elle "prisma migrate resolve --applied" ile "tamamlandı" işaretlenmişti. O elle
-- müdahale sırasında "ExpenseStatus" tipi tırnaksız (`CREATE TYPE ExpenseStatus ...`)
-- oluşturulmuş ve Postgres onu küçük harfe katlayarak `expensestatus` yapmış — schema.prisma
-- ise `"ExpenseStatus"` (büyük/küçük harf duyarlı, tırnaklı) bekliyor. Sonuç: `/dashboard/pos`
-- her `prisma.expense.aggregate()` çağrısında "type public.ExpenseStatus does not exist"
-- hatası atıyordu. Veri kaybı yok — sadece tip adı düzeltiliyor (mevcut "expenses"."status"
-- kolonu aynı tipin OID'ini referans aldığı için yeniden adlandırma anlık ve şeffaf).
ALTER TYPE "expensestatus" RENAME TO "ExpenseStatus";
