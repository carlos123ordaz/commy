import { Router } from 'express';
import { restaurantController } from './restaurant.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createRestaurantSchema, updateRestaurantSchema, updateChannelConfigSchema } from './restaurant.validators';

const router = Router();

// Super Admin routes
router.get('/', authenticate, authorize('superadmin'), restaurantController.findAll.bind(restaurantController));
router.post('/', authenticate, authorize('superadmin'), validate(createRestaurantSchema), restaurantController.create.bind(restaurantController));
router.get('/:id', authenticate, authorize('superadmin'), restaurantController.findById.bind(restaurantController));
router.patch('/:id', authenticate, authorize('superadmin'), validate(updateRestaurantSchema), restaurantController.update.bind(restaurantController));
router.patch('/:id/toggle-status', authenticate, authorize('superadmin'), restaurantController.toggleStatus.bind(restaurantController));

// Public channel lookup (delivery/takeaway QR scan)
router.get('/channel/:channel/:token', restaurantController.getChannelInfo.bind(restaurantController));

// Restaurant own routes
router.get('/me/info', authenticate, requireRestaurant, restaurantController.getMe.bind(restaurantController));
router.patch('/me/info', authenticate, authorize('owner'), requireRestaurant, validate(updateRestaurantSchema), restaurantController.updateMe.bind(restaurantController));
router.patch('/me/channels', authenticate, authorize('owner'), requireRestaurant, validate(updateChannelConfigSchema), restaurantController.updateChannelConfig.bind(restaurantController));
router.post('/me/channels/:channel/qr', authenticate, authorize('owner'), requireRestaurant, restaurantController.generateChannelQR.bind(restaurantController));

export default router;
