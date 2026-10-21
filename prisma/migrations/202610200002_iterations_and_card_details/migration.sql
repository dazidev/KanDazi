-- Preserve existing board metadata and card content when introducing the new fields.
ALTER TABLE "Board" RENAME COLUMN "sprint" TO "iteration";
ALTER TABLE "Board" RENAME COLUMN "deadline" TO "endDate";
ALTER TABLE "Board" ADD COLUMN "startDate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Card" RENAME COLUMN "text" TO "name";
ALTER TABLE "Card" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
