-- AlterTable
ALTER TABLE "Batches" ADD COLUMN     "CurrentStage" INTEGER,
ADD COLUMN     "StageStartedAt" TIMESTAMPTZ,
ADD COLUMN     "StartedAt" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "RecipeStage" (
    "StageID" SERIAL NOT NULL,
    "RecipeID" INTEGER,
    "StageOrder" INTEGER NOT NULL,
    "DurationMinutes" INTEGER NOT NULL,
    "TemperatureSetpoint" DOUBLE PRECISION NOT NULL,
    "HumiditySetpoint" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "RecipeStage_pkey" PRIMARY KEY ("StageID")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStage_RecipeID_StageOrder_key" ON "RecipeStage"("RecipeID", "StageOrder");

-- AddForeignKey
ALTER TABLE "RecipeStage" ADD CONSTRAINT "RecipeStage_RecipeID_fkey" FOREIGN KEY ("RecipeID") REFERENCES "Recipes"("RecipeID") ON DELETE SET NULL ON UPDATE CASCADE;
