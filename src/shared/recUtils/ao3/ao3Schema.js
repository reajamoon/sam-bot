// AO3 metadata schema using Zod

import { z } from 'zod';


// AO3 metadata schema using Zod
const AO3Schema = z.object({
  // Required for embed/model
  title: z.string(),
  authors: z.array(z.string()),
  url: z.string().url().optional().nullable(),
  summary: z.string().optional(),
  rating: z.string().optional(),
  wordCount: z.number().int().optional(),
  chapters: z.string().optional(),
  status: z.string().optional(),
  language: z.string().optional(),
  publishedDate: z.string().optional(),
  updatedDate: z.string().optional(),
  completedDate: z.string().optional(),
  kudos: z.number().int().optional(),
  hits: z.number().int().optional(),
  bookmarks: z.number().int().optional(),
  comments: z.number().int().optional(),
  category: z.string().optional(),
  // Tag arrays
  fandom_tags: z.array(z.string()).optional(),
  archive_warnings: z.array(z.string()).optional(),
  archiveWarnings: z.array(z.string()).optional(),
  relationship_tags: z.array(z.string()).optional(),
  character_tags: z.array(z.string()).optional(),
  category_tags: z.array(z.string()).optional(),
  freeform_tags: z.array(z.string()).optional(),
  required_tags: z.array(z.string()).optional(),
  collections: z.array(z.string()).optional(),
  // Other
  unknownFields: z.record(z.any()).optional(),
  unknownStats: z.record(z.any()).optional(),
  warnings: z.array(z.string()).optional(),
  error: z.any().optional(),
  rawHtml: z.string().optional(),
});


export default AO3Schema;
