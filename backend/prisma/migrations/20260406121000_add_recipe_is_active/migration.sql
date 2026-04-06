-- Add soft-delete visibility flag for recipes
ALTER TABLE "Recipes"
ADD COLUMN "IsActive" BOOLEAN NOT NULL DEFAULT true;