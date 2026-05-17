CREATE TABLE IF NOT EXISTS "PolicyAssistantQuery" (
  "id" TEXT NOT NULL,
  "cooperativeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "retrievedChunks" JSONB NOT NULL,
  "answer" TEXT NOT NULL,
  "citations" JSONB NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'English',
  "intent" TEXT NOT NULL DEFAULT 'policy',
  "suggestedAction" JSONB,
  "userFeedback" TEXT,
  "feedback" TEXT,
  "feedbackReason" TEXT,
  "latencyMs" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PolicyAssistantQuery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PolicyAssistantQuery_cooperativeId_createdAt_idx"
  ON "PolicyAssistantQuery"("cooperativeId", "createdAt");

CREATE INDEX IF NOT EXISTS "PolicyAssistantQuery_userId_createdAt_idx"
  ON "PolicyAssistantQuery"("userId", "createdAt");
