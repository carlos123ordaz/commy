import { Router } from 'express';
import { orderController } from './order.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { joinTableSchema, addItemSchema, updateItemSchema, changeStatusSchema, createManualOrderSchema, createChannelOrderSchema } from './order.validators';

const router = Router();

// Public routes (customers)
router.post('/join-table', validate(joinTableSchema), orderController.joinTable.bind(orderController));
router.post('/channel', validate(createChannelOrderSchema), orderController.createChannelOrder.bind(orderController));
router.get('/:id', orderController.getOrder.bind(orderController));
router.post('/:id/items', validate(addItemSchema), orderController.addItem.bind(orderController));
router.patch('/:id/items/:itemId', validate(updateItemSchema), orderController.updateItem.bind(orderController));
router.delete('/:id/items/:itemId', orderController.removeItem.bind(orderController));
router.post('/:id/ready', orderController.markReady.bind(orderController));
router.post('/:id/submit', orderController.submitOrder.bind(orderController));

// Staff routes
router.use(authenticate, requireRestaurant);
router.get('/', authorize('owner', 'cashier', 'waiter'), orderController.getOrders.bind(orderController));
router.get('/live/all', authorize('owner', 'cashier', 'kitchen', 'waiter'), orderController.getLiveOrders.bind(orderController));
router.get('/stats/today', authorize('owner', 'cashier'), orderController.getTodayStats.bind(orderController));
router.get('/stats/hourly', authorize('owner', 'cashier'), orderController.getHourlyStats.bind(orderController));
router.post('/manual', authorize('owner', 'cashier'), validate(createManualOrderSchema), orderController.createManualOrder.bind(orderController));
router.patch('/:id/status', authorize('owner', 'cashier', 'kitchen', 'waiter'), validate(changeStatusSchema), orderController.changeStatus.bind(orderController));

export default router;
