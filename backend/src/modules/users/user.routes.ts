import { Router } from 'express';
import { userController } from './user.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createUserSchema, updateUserSchema } from './user.validators';

const router = Router();

router.use(authenticate, requireRestaurant);

router.get('/', authorize('owner', 'cashier'), userController.findAll.bind(userController));
router.post('/', authorize('owner'), validate(createUserSchema), userController.create.bind(userController));
router.patch('/:id', authorize('owner'), validate(updateUserSchema), userController.update.bind(userController));
router.patch('/:id/toggle-status', authorize('owner'), userController.toggleStatus.bind(userController));

export default router;
