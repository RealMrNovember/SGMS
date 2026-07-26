-- Mobil self-servis kayıt (/api/v1/auth/signup) artık üyeyi doğrudan ACTIVE
-- yapmıyor; salon onaylayana kadar PENDING_APPROVAL durumunda kalır ve
-- giriş yapamaz (bkz. auth/login route'undaki status==='ACTIVE' kontrolü).

ALTER TYPE "GymMemberStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
