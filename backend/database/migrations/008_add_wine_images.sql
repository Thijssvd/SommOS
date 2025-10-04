-- Migration: Add image_url column to Wines table
-- Description: Stores URLs to wine bottle images (from Unsplash API or custom uploads)
-- Date: 2025-10-04

-- Add image_url column to Wines table
ALTER TABLE Wines ADD COLUMN image_url TEXT;

-- Create index for faster queries on wines with images
CREATE INDEX IF NOT EXISTS idx_wines_image_url ON Wines(image_url) WHERE image_url IS NOT NULL;
