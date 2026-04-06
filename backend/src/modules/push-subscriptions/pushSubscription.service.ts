import webpush from 'web-push';
import { env } from '../../config/env';
import { PushSubscriptionModel } from './pushSubscription.model';

webpush.setVapidDetails(env.VAPID_MAILTO, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export class PushSubscriptionService {
  async subscribe(userId: string, restaurantId: string, subscription: PushSubscriptionInput) {
    await PushSubscriptionModel.findOneAndUpdate(
      { user: userId, endpoint: subscription.endpoint },
      { user: userId, restaurant: restaurantId, ...subscription },
      { upsert: true, new: true }
    );
  }

  async unsubscribe(userId: string, endpoint: string) {
    await PushSubscriptionModel.deleteOne({ user: userId, endpoint });
  }

  async sendToRestaurant(
    restaurantId: string,
    payload: { title: string; body: string; data?: Record<string, unknown> }
  ) {
    const subscriptions = await PushSubscriptionModel.find({ restaurant: restaurantId });
    if (!subscriptions.length) return;

    const message = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          message
        )
      )
    );

    // Eliminar suscripciones que ya no son válidas (410 Gone / 404)
    const expiredEndpoints: string[] = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err.statusCode === 410 || err.statusCode === 404) {
          expiredEndpoints.push(subscriptions[i].endpoint);
        }
      }
    });

    if (expiredEndpoints.length) {
      await PushSubscriptionModel.deleteMany({ endpoint: { $in: expiredEndpoints } });
    }
  }
}

export const pushSubscriptionService = new PushSubscriptionService();
