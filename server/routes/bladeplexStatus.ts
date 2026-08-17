import { getBladePlexStatus } from '@server/lib/bladeplexStatus';
import { Router } from 'express';

const router = Router();

router.get('/', async (_req, res) => {
  return res.status(200).json(await getBladePlexStatus());
});

export default router;
