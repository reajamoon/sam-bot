// AO3 metadata schema using Zod
const { z } = require('zod');

const StatsSchema = z.object({
  published: z.string().optional(),
  updated: z.string().optional(),
  completed: z.string().optional(),
  words: z.number().int().optional(),
  chapters: z.string().optional(),
  comments: z.number().int().optional(),
  kudos: z.number().int().optional(),
  bookmarks: z.number().int().optional(),
  hits: z.number().int().optional(),
}).partial();

const AO3Schema = z.object({
  title: z.string(),
  authors: z.array(z.string()),
  url: z.string().url().optional().nullable(),
  summary: z.string().optional(),
  fandom_tags: z.array(z.string()).optional(),
  archive_warnings: z.array(z.string()).optional(),
  relationship_tags: z.array(z.string()).optional(),
  character_tags: z.array(z.string()).optional(),
  category_tags: z.array(z.string()).optional(),
  freeform_tags: z.array(z.string()).optional(),
  required_tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  language: z.string().optional(),
  rating: z.string().optional(),
  stats: StatsSchema.optional(),
  unknownFields: z.record(z.any()).optional(),
  unknownStats: z.record(z.any()).optional(),
  warnings: z.array(z.string()).optional(),
  error: z.any().optional(),
});

module.exports = AO3Schema;
