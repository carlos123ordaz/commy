import { Router } from 'express';
import { notificationController } from './notification.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';

const router = Router();

// Public (customer)
router.post('/', notificationController.create.bind(notificationController));

// Staff
router.use(authenticate, requireRestaurant);
router.get('/', notificationController.getUnresolved.bind(notificationController));
router.get('/all', notificationController.getAll.bind(notificationController));
router.patch('/:id/resolve', authorize('owner', 'cashier', 'waiter'), notificationController.resolve.bind(notificationController));

export default router;
