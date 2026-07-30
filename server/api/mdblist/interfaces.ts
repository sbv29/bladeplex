import { z } from 'zod';

const MdblistIdsSchema = z.object({
  mdblist: z.string().optional(),
  imdb: z.string().nullable().optional(),
  tmdb: z.number().int().positive().nullable().optional(),
  tvdb: z.number().int().positive().nullable().optional(),
});

export const MdblistMovieItemSchema = z.object({
  id: z.number().int().optional(),
  rank: z.number().int().positive(),
  adult: z.number().int().optional().default(0),
  title: z.string().optional(),
  imdb_id: z.string().nullable().optional(),
  ids: MdblistIdsSchema,
  mediatype: z.literal('movie').optional(),
  release_year: z.number().int().nullable().optional(),
});

export const MdblistListItemsResponseSchema = z.object({
  movies: z.array(MdblistMovieItemSchema),
  pagination: z
    .object({
      total: z.number().int().nonnegative().optional(),
      has_more: z.boolean().optional(),
      next_cursor: z.string().nullable().optional(),
    })
    .optional(),
});

const MdblistListMetadataObjectSchema = z.object({
  id: z.number().int().positive().nullable().optional(),
  name: z.string().trim().min(1).max(200).nullable().optional(),
  slug: z.string().trim().min(1).max(200).nullable().optional(),
  private: z
    .union([z.boolean(), z.literal(0), z.literal(1)])
    .nullable()
    .optional()
    .transform((value) => value === true || value === 1),
  mediatype: z.string().trim().nullable().optional(),
  user_name: z.string().trim().nullable().optional(),
  items: z.number().int().nonnegative().nullable().optional(),
});

export const MdblistListMetadataSchema = z
  .union([
    MdblistListMetadataObjectSchema,
    z.array(MdblistListMetadataObjectSchema).length(1),
  ])
  .transform((metadata) => (Array.isArray(metadata) ? metadata[0] : metadata));

export type MdblistListType = 'official' | 'public';

export type MdblistListReference =
  | {
      type: 'official';
      slug: string;
    }
  | {
      type: 'public';
      username: string;
      slug: string;
    };

export type MdblistMovieItem = z.infer<typeof MdblistMovieItemSchema>;
export type MdblistListItemsResponse = z.infer<
  typeof MdblistListItemsResponseSchema
>;
export type MdblistListMetadata = z.infer<typeof MdblistListMetadataSchema>;
