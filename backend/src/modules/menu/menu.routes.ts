import { Router } from 'express';
import { menuController } from './menu.controller';
import { authenticate, authorize, requireRestaurant } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCategorySchema, createProductSchema, createModifierGroupSchema } from './menu.validators';

const router = Router();

// Public routes for customers
router.get('/public/:restaurantId/categories', menuController.getPublicCategories.bind(menuController));
router.get('/public/:restaurantId/products', menuController.getPublicProducts.bind(menuController));
// Returns a single product with menuGroups.allowedProducts populated (for customer menu UI)
router.get('/public/:restaurantId/products/:productId', menuController.getPublicProduct.bind(menuController));

// Protected routes
router.use(authenticate, requireRestaurant);

// Categories
router.get('/categories', menuController.getCategories.bind(menuController));
router.post('/categories', authorize('owner', 'cashier'), validate(createCategorySchema), menuController.createCategory.bind(menuController));
router.patch('/categories/:id', authorize('owner', 'cashier'), menuController.updateCategory.bind(menuController));
router.delete('/categories/:id', authorize('owner'), menuController.deleteCategory.bind(menuController));

// Products
router.get('/products', menuController.getProducts.bind(menuController));
router.post('/products', authorize('owner', 'cashier'), validate(createProductSchema), menuController.createProduct.bind(menuController));
router.patch('/products/:id', authorize('owner', 'cashier'), menuController.updateProduct.bind(menuController));
router.patch('/products/:id/toggle-availability', authorize('owner', 'cashier'), menuController.toggleAvailability.bind(menuController));
router.delete('/products/:id', authorize('owner'), menuController.deleteProduct.bind(menuController));

// Modifier Groups
router.get('/modifier-groups', menuController.getModifierGroups.bind(menuController));
router.post('/modifier-groups', authorize('owner', 'cashier'), validate(createModifierGroupSchema), menuController.createModifierGroup.bind(menuController));
router.patch('/modifier-groups/:id', authorize('owner', 'cashier'), menuController.updateModifierGroup.bind(menuController));
router.delete('/modifier-groups/:id', authorize('owner'), menuController.deleteModifierGroup.bind(menuController));

export default router;
