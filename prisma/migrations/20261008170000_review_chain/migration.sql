CREATE TYPE "ReviewSeat" AS ENUM ('TEAM_LEADER', 'OPERATION_MANAGER', 'PROJECT_MANAGER');
CREATE TYPE "ReviewOutcome" AS ENUM ('APPROVED', 'REJECTED');

CREATE TABLE "DepartmentReviewer" (
  "departmentId" TEXT NOT NULL,
  "seat" "ReviewSeat" NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "DepartmentReviewer_pkey" PRIMARY KEY ("departmentId", "seat")
);

CREATE INDEX "DepartmentReviewer_userId_idx" ON "DepartmentReviewer"("userId");

ALTER TABLE "DepartmentReviewer" ADD CONSTRAINT "DepartmentReviewer_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DepartmentReviewer" ADD CONSTRAINT "DepartmentReviewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Correction" ADD COLUMN "stage" "ReviewSeat" NOT NULL DEFAULT 'TEAM_LEADER';
ALTER TABLE "AttendanceRequest" ADD COLUMN "stage" "ReviewSeat" NOT NULL DEFAULT 'TEAM_LEADER';

CREATE TABLE "ReviewDecision" (
  "id" TEXT NOT NULL,
  "seat" "ReviewSeat" NOT NULL,
  "outcome" "ReviewOutcome" NOT NULL,
  "note" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "correctionId" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewDecision_one_subject_check" CHECK (
    ("correctionId" IS NOT NULL AND "requestId" IS NULL)
    OR ("correctionId" IS NULL AND "requestId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "ReviewDecision_correctionId_seat_key" ON "ReviewDecision"("correctionId", "seat");
CREATE UNIQUE INDEX "ReviewDecision_requestId_seat_key" ON "ReviewDecision"("requestId", "seat");
CREATE INDEX "ReviewDecision_reviewerId_idx" ON "ReviewDecision"("reviewerId");

ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_correctionId_fkey" FOREIGN KEY ("correctionId") REFERENCES "Correction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReviewDecision" ADD CONSTRAINT "ReviewDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "AttendanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
