import { Router } from 'express';
import { floorPlanController } from './floorPlan.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';

const router = Router();

router.use(authenticate, requireRestaurant);

router.get('/', floorPlanController.getLayout.bind(floorPlanController));
router.put(
  '/',
  authorize('owner', 'cashier'),
  floorPlanController.saveLayout.bind(floorPlanController)
);

export default router;
