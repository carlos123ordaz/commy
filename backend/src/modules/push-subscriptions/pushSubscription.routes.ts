import { Router, Response } from 'express';
import { authenticate, requireRestaurant } from '../../middleware/auth.middleware';
import { pushSubscriptionService } from './pushSubscription.service';
import { env } from '../../config/env';
import { AuthRequest } from '../../common/types';

const router = Router();

// Devuelve la clave pública VAPID (pública, sin auth)
router.get('/vapid-public-key', (_req: AuthRequest, res: Response) => {
  res.json({ data: { publicKey: env.VAPID_PUBLIC_KEY } });
});

// Registrar suscripción
router.post('/', authenticate, requireRestaurant, async (req: AuthRequest, res: Response) => {
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    res.status(400).json({ message: 'Invalid subscription payload' });
    return;
  }

  await pushSubscriptionService.subscribe(
    req.user!.userId,
    req.user!.restaurantId!,
    { endpoint, keys }
  );

  res.status(201).json({ message: 'Subscribed' });
});

// Eliminar suscripción (cuando el usuario desactiva notificaciones)
router.delete('/', authenticate, async (req: AuthRequest, res: Response) => {
  const { endpoint } = req.body as { endpoint: string };
  if (!endpoint) {
    res.status(400).json({ message: 'endpoint required' });
    return;
  }
  await pushSubscriptionService.unsubscribe(req.user!.userId, endpoint);
  res.json({ message: 'Unsubscribed' });
});

export default router;
