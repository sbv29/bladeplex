import MdblistAPI from '@server/api/mdblist';
import { DiscoverSliderType } from '@server/constants/discover';
import dataSource, { getRepository } from '@server/datasource';
import CustomList from '@server/entity/CustomList';
import DiscoverSlider from '@server/entity/DiscoverSlider';
import {
  MdblistListValidationError,
  parseMdblistListUrl,
} from '@server/lib/mdblistListUrl';
import { getSettings } from '@server/lib/settings';
import logger from '@server/logger';
import { Router } from 'express';
import { In } from 'typeorm';
import { z } from 'zod';

const customListRoutes = Router();

const listInputSchema = z.object({
  url: z.string().trim().min(1).max(500),
  title: z.string().trim().min(1).max(100).optional(),
});

const titleSchema = z.object({
  title: z.string().trim().min(1).max(100),
});

const titleFromSlug = (slug: string): string =>
  slug
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const validateList = async (input: z.infer<typeof listInputSchema>) => {
  const settings = getSettings();
  if (!settings.main.mdblistApiKey) {
    throw new MdblistListValidationError(
      'Configure the MDBList API key in General settings first.'
    );
  }

  const parsedUrl = parseMdblistListUrl(input.url);
  const client = new MdblistAPI(settings.main.mdblistApiKey);
  const fallbackTitle = titleFromSlug(parsedUrl.reference.slug);

  if (parsedUrl.reference.type === 'official') {
    const items = await client.getMovieList({
      reference: parsedUrl.reference,
      limit: 1000,
    });
    const providerTitle =
      parsedUrl.reference.slug === 'justwatch-streaming-charts'
        ? 'United States Daily Streaming Charts: Movies'
        : fallbackTitle;

    return {
      canonicalUrl: parsedUrl.canonicalUrl,
      listType: parsedUrl.listType,
      reference: parsedUrl.reference,
      title: input.title ?? providerTitle,
      providerTitle,
      itemCount: items.length,
      preview: items.slice(0, 5).map((item) => ({
        rank: item.rank,
        title: item.title ?? 'Untitled',
        year: item.release_year,
        tmdbId: item.ids.tmdb,
      })),
    };
  }

  const metadata = await client.getListMetadata(parsedUrl.reference);

  if (metadata.private) {
    throw new MdblistListValidationError(
      'Private MDBList lists are not supported.'
    );
  }

  const mediaType = metadata.mediatype?.toLowerCase();
  if (mediaType && !['movie', 'movies'].includes(mediaType)) {
    throw new MdblistListValidationError(
      'Phase 1 supports MDBList movie lists only.'
    );
  }

  const previewItems = await client.getMovieList({
    reference: parsedUrl.reference,
    limit: 5,
  });

  return {
    canonicalUrl: parsedUrl.canonicalUrl,
    listType: parsedUrl.listType,
    reference: parsedUrl.reference,
    title: input.title ?? metadata.name ?? fallbackTitle,
    providerTitle: metadata.name ?? fallbackTitle,
    itemCount: metadata.items ?? previewItems.length,
    preview: previewItems.slice(0, 5).map((item) => ({
      rank: item.rank,
      title: item.title ?? 'Untitled',
      year: item.release_year,
      tmdbId: item.ids.tmdb,
    })),
  };
};

const serializeLists = async (lists: CustomList[]) => {
  const sliderRepository = getRepository(DiscoverSlider);
  const sliders = lists.length
    ? await sliderRepository.find({
        where: {
          type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
          data: In(lists.map((list) => String(list.id))),
        },
      })
    : [];

  return lists.map((list) => {
    const slider = sliders.find((item) => item.data === String(list.id));
    return {
      ...list,
      discoverSlider: slider
        ? {
            id: slider.id,
            enabled: slider.enabled,
            order: slider.order,
          }
        : null,
    };
  });
};

customListRoutes.get('/', async (_req, res) => {
  const lists = await getRepository(CustomList).find({
    order: { createdAt: 'ASC' },
  });
  return res.json({
    mdblistConfigured: Boolean(getSettings().main.mdblistApiKey),
    items: await serializeLists(lists),
  });
});

customListRoutes.post('/validate', async (req, res, next) => {
  const parsed = listInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid custom list settings.' });
  }

  try {
    return res.json(await validateList(parsed.data));
  } catch (error) {
    logger.warn('MDBList custom list validation failed', {
      label: 'MDBList',
      errorType:
        error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    return next({
      status: 400,
      message:
        error instanceof MdblistListValidationError
          ? error.message
          : 'Unable to validate this MDBList list.',
    });
  }
});

customListRoutes.post('/', async (req, res, next) => {
  const parsed = listInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid custom list settings.' });
  }

  try {
    const validated = await validateList(parsed.data);
    const username =
      validated.reference.type === 'public' ? validated.reference.username : '';
    const existing = await getRepository(CustomList).findOne({
      where: {
        provider: 'mdblist',
        listType: validated.listType,
        username,
        slug: validated.reference.slug,
        mediaType: 'movie',
      },
    });
    if (existing) {
      return next({
        status: 409,
        message: 'This MDBList list already exists.',
      });
    }

    const saved = await dataSource.transaction(async (manager) => {
      const listRepository = manager.getRepository(CustomList);
      const sliderRepository = manager.getRepository(DiscoverSlider);
      const list = await listRepository.save(
        new CustomList({
          provider: 'mdblist',
          listType: validated.listType,
          title: validated.title,
          sourceUrl: validated.canonicalUrl,
          username,
          slug: validated.reference.slug,
          mediaType: 'movie',
          itemCount: validated.itemCount,
        })
      );
      const maxOrder = await sliderRepository
        .createQueryBuilder('slider')
        .select('MAX(slider.order)', 'max')
        .getRawOne<{ max: number | null }>();
      await sliderRepository.save(
        new DiscoverSlider({
          type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
          title: list.title,
          data: String(list.id),
          enabled: true,
          isBuiltIn: true,
          order: Number(maxOrder?.max ?? -1) + 1,
        })
      );
      return list;
    });

    return res.status(201).json((await serializeLists([saved]))[0]);
  } catch (error) {
    logger.warn('Unable to create MDBList custom list', {
      label: 'MDBList',
      errorType:
        error instanceof Error ? error.constructor.name : 'UnknownError',
    });
    return next({
      status: 400,
      message:
        error instanceof MdblistListValidationError
          ? error.message
          : 'Unable to create this MDBList list.',
    });
  }
});

customListRoutes.put('/:listId', async (req, res, next) => {
  const parsed = titleSchema.safeParse(req.body);
  if (!parsed.success) {
    return next({ status: 400, message: 'Invalid custom list title.' });
  }

  const listId = Number(req.params.listId);
  try {
    const list = await dataSource.transaction(async (manager) => {
      const listRepository = manager.getRepository(CustomList);
      const sliderRepository = manager.getRepository(DiscoverSlider);
      const existing = await listRepository.findOneOrFail({
        where: { id: listId },
      });
      existing.title = parsed.data.title;
      await sliderRepository.update(
        {
          type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
          data: String(listId),
        },
        { title: parsed.data.title }
      );
      return listRepository.save(existing);
    });
    return res.json((await serializeLists([list]))[0]);
  } catch {
    return next({ status: 404, message: 'Custom list not found.' });
  }
});

customListRoutes.delete('/:listId', async (req, res, next) => {
  const listId = Number(req.params.listId);
  try {
    await dataSource.transaction(async (manager) => {
      const listRepository = manager.getRepository(CustomList);
      const sliderRepository = manager.getRepository(DiscoverSlider);
      const list = await listRepository.findOneOrFail({
        where: { id: listId },
      });
      await sliderRepository.delete({
        type: DiscoverSliderType.MDBLIST_CUSTOM_MOVIES,
        data: String(listId),
      });
      await listRepository.remove(list);
    });
    return res.status(204).send();
  } catch {
    return next({ status: 404, message: 'Custom list not found.' });
  }
});

export default customListRoutes;
