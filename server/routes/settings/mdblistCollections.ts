import { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import {
  MDBLIST_COLLECTION_MAX_TITLE_LENGTH,
  MDBLIST_COLLECTION_MAX_URL_LENGTH,
  MDBLIST_COLLECTION_OVERLAY_COLOR_PATTERN,
  MdblistCollectionError,
  MdblistCollectionService,
} from '@server/lib/mdblistCollections';
import { isServerOwner } from '@server/lib/serverOwner';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const routes = Router();

const createSchema = z.object({
  url: z.string().trim().min(1).max(MDBLIST_COLLECTION_MAX_URL_LENGTH),
  title: z
    .string()
    .trim()
    .min(1)
    .max(MDBLIST_COLLECTION_MAX_TITLE_LENGTH)
    .optional(),
  artworkOverlayColor: z
    .string()
    .regex(MDBLIST_COLLECTION_OVERLAY_COLOR_PATTERN)
    .optional(),
  mediaType: z.enum(['movie', 'tv']).default('movie'),
});
const updateSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1)
      .max(MDBLIST_COLLECTION_MAX_URL_LENGTH)
      .optional(),
    title: z
      .string()
      .trim()
      .min(1)
      .max(MDBLIST_COLLECTION_MAX_TITLE_LENGTH)
      .optional(),
    artworkOverlayColor: z
      .string()
      .regex(MDBLIST_COLLECTION_OVERLAY_COLOR_PATTERN)
      .optional(),
  })
  .refine(
    (value) =>
      value.url !== undefined ||
      value.title !== undefined ||
      value.artworkOverlayColor !== undefined
  );
const reorderSchema = z.object({
  ids: z.array(z.number().int().positive()).max(100),
  mediaType: z.enum(['movie', 'tv']).default('movie'),
});
const enabledSchema = z.object({ enabled: z.boolean() });

const serialize = (list: CustomList) => ({
  id: list.id,
  title: list.title,
  sourceUrl: list.sourceUrl,
  listType: list.listType,
  owner: list.username || 'official',
  slug: list.slug,
  mediaType: list.mediaType,
  itemCount: list.itemCount,
  enabled: list.enabled,
  sortOrder: list.sortOrder,
  mdblistId: list.mdblistId,
  selectedArtworkTmdbId: list.selectedArtworkTmdbId,
  selectedArtworkPosterPath: list.selectedArtworkPosterPath,
  artworkOverlayColor: list.artworkOverlayColor,
  lastValidatedAt: list.lastValidatedAt,
  metadata: list.metadata ? JSON.parse(list.metadata) : null,
  createdAt: list.createdAt,
  updatedAt: list.updatedAt,
});

const errorStatus = (error: MdblistCollectionError) => {
  switch (error.code) {
    case 'not_found':
      return 404;
    case 'duplicate':
      return 409;
    case 'limit':
      return 422;
    default:
      return 400;
  }
};

const handleError = (error: unknown, next: (error: unknown) => void) => {
  if (error instanceof MdblistCollectionError) {
    return next({ status: errorStatus(error), message: error.message });
  }
  return next({
    status: 500,
    message: 'Unable to manage MDBList collections.',
  });
};

routes.use((req, _res, next) => {
  if (!isServerOwner(req.user)) {
    return next({
      status: 403,
      message: 'Only the server owner can manage MDBList collections.',
    });
  }
  next();
});

routes.get('/', async (_req, res) => {
  const items = await getRepository(CustomList).find({
    where: { provider: 'mdblist', isCollection: true },
    order: { mediaType: 'ASC', sortOrder: 'ASC', id: 'ASC' },
  });
  return res.json({
    mdblistConfigured: Boolean(getSettings().main.mdblistApiKey),
    items: items.map(serialize),
  });
});

routes.post(
  '/validate',
  rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  async (req, res, next) => {
    const input = createSchema.safeParse(req.body);
    if (!input.success)
      return next({ status: 400, message: 'Invalid collection settings.' });
    try {
      const validated = await new MdblistCollectionService({
        language: req.locale,
      }).validate(input.data.url, input.data.title, input.data.mediaType);
      return res.json({
        canonicalUrl: validated.canonicalUrl,
        listType: validated.listType,
        mdblistId: validated.mdblistId,
        sourceTitle: validated.sourceTitle,
        displayTitle: validated.displayTitle,
        owner: validated.owner,
        slug: validated.slug,
        mediaType: validated.mediaType,
        itemCount: validated.itemCount,
        usableItemCount: validated.usableItemCount,
        preview: validated.preview,
        validatedAt: validated.validatedAt,
      });
    } catch (error) {
      return handleError(error, next);
    }
  }
);

routes.post('/', async (req, res, next) => {
  const input = createSchema.safeParse(req.body);
  if (!input.success)
    return next({ status: 400, message: 'Invalid collection settings.' });
  try {
    const list = await new MdblistCollectionService({
      language: req.locale,
    }).create(input.data);
    return res.status(201).json(serialize(list));
  } catch (error) {
    return handleError(error, next);
  }
});

routes.put('/reorder', async (req, res, next) => {
  const input = reorderSchema.safeParse(req.body);
  if (!input.success)
    return next({ status: 400, message: 'Invalid collection order.' });
  try {
    return res.json(
      (
        await new MdblistCollectionService().reorder(
          input.data.ids,
          input.data.mediaType
        )
      ).map(serialize)
    );
  } catch (error) {
    return handleError(error, next);
  }
});

routes.put('/:id', async (req, res, next) => {
  const input = updateSchema.safeParse(req.body);
  if (!input.success)
    return next({ status: 400, message: 'Invalid collection settings.' });
  try {
    return res.json(
      serialize(
        await new MdblistCollectionService({ language: req.locale }).update(
          Number(req.params.id),
          input.data
        )
      )
    );
  } catch (error) {
    return handleError(error, next);
  }
});

routes.put('/:id/enabled', async (req, res, next) => {
  const input = enabledSchema.safeParse(req.body);
  if (!input.success)
    return next({ status: 400, message: 'Invalid enabled state.' });
  try {
    return res.json(
      serialize(
        await new MdblistCollectionService().setEnabled(
          Number(req.params.id),
          input.data.enabled
        )
      )
    );
  } catch (error) {
    return handleError(error, next);
  }
});

for (const action of ['shuffle-artwork', 'refresh'] as const) {
  routes.post(`/:id/${action}`, async (req, res, next) => {
    try {
      const service = new MdblistCollectionService({ language: req.locale });
      const list =
        action === 'refresh'
          ? await service.refresh(Number(req.params.id))
          : await service.shuffleArtwork(Number(req.params.id));
      return res.json(serialize(list));
    } catch (error) {
      return handleError(error, next);
    }
  });
}

routes.delete('/:id', async (req, res, next) => {
  try {
    await new MdblistCollectionService().delete(Number(req.params.id));
    return res.status(204).send();
  } catch (error) {
    return handleError(error, next);
  }
});

export default routes;
