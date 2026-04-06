import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse, paginationMeta } from '../../common/response/ApiResponse';
import { menuService } from './menu.service';

export class MenuController {
  // Public routes (for customers)
  async getPublicCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await menuService.getCategories(req.params.restaurantId);
      ApiResponse.success(res, categories);
    } catch (e) { next(e); }
  }

  async getPublicProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const products = await menuService.getProducts(req.params.restaurantId, req.query.categoryId as string);
      ApiResponse.success(res, products);
    } catch (e) { next(e); }
  }

  async getPublicProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await menuService.getPublicProductWithGroups(req.params.restaurantId, req.params.productId);
      ApiResponse.success(res, product);
    } catch (e) { next(e); }
  }

  // Category CRUD
  async createCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cat = await menuService.createCategory(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, cat, 'Category created');
    } catch (e) { next(e); }
  }

  async getCategories(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cats = await menuService.getCategories(req.user!.restaurantId!, true);
      ApiResponse.success(res, cats);
    } catch (e) { next(e); }
  }

  async updateCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const cat = await menuService.updateCategory(req.params.id, req.user!.restaurantId!, req.body);
      ApiResponse.success(res, cat, 'Category updated');
    } catch (e) { next(e); }
  }

  async deleteCategory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteCategory(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, null, 'Category deleted');
    } catch (e) { next(e); }
  }

  // Product CRUD
  async createProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await menuService.createProduct(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, product, 'Product created');
    } catch (e) { next(e); }
  }

  async getProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page || '1'));
      const limit = parseInt(String(req.query.limit || '20'));
      const { data, total } = await menuService.getProductsPaginated(
        req.user!.restaurantId!,
        page,
        limit,
        req.query.search as string,
        req.query.categoryId as string
      );
      ApiResponse.paginated(res, data, paginationMeta(total, page, limit));
    } catch (e) { next(e); }
  }

  async updateProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await menuService.updateProduct(req.params.id, req.user!.restaurantId!, req.body);
      ApiResponse.success(res, product, 'Product updated');
    } catch (e) { next(e); }
  }

  async toggleAvailability(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await menuService.toggleAvailability(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, product, `Product ${product.isAvailable ? 'available' : 'unavailable'}`);
    } catch (e) { next(e); }
  }

  async deleteProduct(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteProduct(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, null, 'Product deleted');
    } catch (e) { next(e); }
  }

  // Modifier Groups
  async createModifierGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await menuService.createModifierGroup(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, group, 'Modifier group created');
    } catch (e) { next(e); }
  }

  async getModifierGroups(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const groups = await menuService.getModifierGroups(req.user!.restaurantId!);
      ApiResponse.success(res, groups);
    } catch (e) { next(e); }
  }

  async updateModifierGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const group = await menuService.updateModifierGroup(req.params.id, req.user!.restaurantId!, req.body);
      ApiResponse.success(res, group, 'Modifier group updated');
    } catch (e) { next(e); }
  }

  async deleteModifierGroup(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await menuService.deleteModifierGroup(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, null, 'Modifier group deleted');
    } catch (e) { next(e); }
  }
}

export const menuController = new MenuController();
