import { Router } from 'express';
import { customerController } from './customer.controller';
import { authenticate, authorize, requireRestaurant, authenticateCustomer } from '../../middleware/auth.middleware';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize('owner', 'cashier'),
  requireRestaurant,
  customerController.list.bind(customerController)
);

router.patch(
  '/me',
  authenticateCustomer,
  customerController.updateProfile.bind(customerController)
);

export default router;
