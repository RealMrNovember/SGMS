-- CreateTable
CREATE TABLE "two_factor_recovery_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "two_factor_recovery_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_recovery_tokens_token_hash_key" ON "two_factor_recovery_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "two_factor_recovery_tokens_user_id_idx" ON "two_factor_recovery_tokens"("user_id");

-- CreateIndex
CREATE INDEX "two_factor_recovery_tokens_expires_at_idx" ON "two_factor_recovery_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "two_factor_recovery_tokens" ADD CONSTRAINT "two_factor_recovery_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
