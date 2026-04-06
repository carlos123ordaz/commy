import { Router } from 'express';
import { tableController } from './table.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createTableSchema, updateTableSchema } from './table.validators';

const router = Router();

// Public route for QR validation
router.get('/token/:token', tableController.findByToken.bind(tableController));

// Protected routes
router.use(authenticate, requireRestaurant);

router.get('/', tableController.findAll.bind(tableController));
router.post('/', authorize('owner', 'cashier'), validate(createTableSchema), tableController.create.bind(tableController));
router.post('/export-pdf', authorize('owner', 'cashier'), tableController.exportPdf.bind(tableController));
router.get('/export-all-pdf', authorize('owner', 'cashier'), tableController.exportAllPdf.bind(tableController));
router.get('/:id', tableController.findById.bind(tableController));
router.patch('/:id', authorize('owner', 'cashier'), validate(updateTableSchema), tableController.update.bind(tableController));
router.delete('/:id', authorize('owner'), tableController.delete.bind(tableController));
router.get('/:id/qr', tableController.getQr.bind(tableController));
router.post('/:id/regenerate-qr', authorize('owner'), tableController.regenerateQr.bind(tableController));

export default router;
