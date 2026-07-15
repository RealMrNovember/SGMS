-- 20260715130000_fix_expense_status_enum_case yalnızca tip ADINI düzeltmişti
-- (expensestatus -> "ExpenseStatus"). Ancak 2026-06-30'daki başarısız migrasyonun elle
-- kurtarılması sırasında enum DEĞERLERİ de bozulmuştu: pg_enum.enumlabel gerçekte
-- tek tırnak karakterlerini de içeriyordu — 'OPEN' (6 bayt: '  O  P  E  N  ') yerine
-- OPEN (4 bayt) olması gerekirken. Bu yüzden Prisma'nın gönderdiği düz "OPEN"/"PAID"/"VOID"
-- değerleri Postgres tarafından reddediliyordu: "invalid input value for enum
-- ExpenseStatus: OPEN". RENAME VALUE, var olan satırların OID eşlemesini koruduğu için
-- veri kaybı olmadan ve anlık şekilde etiketleri düzeltir.
ALTER TYPE "ExpenseStatus" RENAME VALUE '''OPEN''' TO 'OPEN';
ALTER TYPE "ExpenseStatus" RENAME VALUE '''PAID''' TO 'PAID';
ALTER TYPE "ExpenseStatus" RENAME VALUE '''VOID''' TO 'VOID';
