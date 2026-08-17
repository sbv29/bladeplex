import { getBladePlexStatus } from '@server/lib/bladeplexStatus';
import { getSettings } from '@server/lib/settings';
import { Router } from 'express';

const router = Router();

router.get('/', async (_req, res) => {
  const settings = getSettings().main;
  if (!settings.statusIndicatorEnabled) {
    return res.status(200).json({
      status: 'unknown',
      statusPageUrl: settings.statusPageUrl,
    });
  }

  return res.status(200).json(await getBladePlexStatus());
});

export default router;
