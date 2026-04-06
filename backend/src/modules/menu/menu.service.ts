import { CategoryModel } from './category.model';
import { ProductModel } from './product.model';
import { ModifierGroupModel } from './modifierGroup.model';
import { CreateCategoryInput, CreateProductInput, CreateModifierGroupInput } from './menu.validators';
import { NotFoundError } from '../../common/errors/AppError';

export class MenuService {
  // Categories
  async createCategory(restaurantId: string, data: CreateCategoryInput) {
    return CategoryModel.create({ ...data, restaurant: restaurantId });
  }

  async getCategories(restaurantId: string, includeInactive = false) {
    const query: Record<string, unknown> = { restaurant: restaurantId };
    if (!includeInactive) query.isActive = true;
    return CategoryModel.find(query).sort({ order: 1, name: 1 });
  }

  async updateCategory(id: string, restaurantId: string, data: Partial<CreateCategoryInput>) {
    const cat = await CategoryModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { $set: data },
      { new: true }
    );
    if (!cat) throw new NotFoundError('Category');
    return cat;
  }

  async deleteCategory(id: string, restaurantId: string) {
    const cat = await CategoryModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { isActive: false },
      { new: true }
    );
    if (!cat) throw new NotFoundError('Category');
    return cat;
  }

  // Products
  async createProduct(restaurantId: string, data: CreateProductInput) {
    return ProductModel.create({ ...data, restaurant: restaurantId });
  }

  /**
   * Returns a single public product with menuGroups.allowedProducts populated.
   * Also populates accompanimentProducts (grouped by category) so companion
   * products (excluded from the main listing) are available for selection.
   */
  async getPublicProductWithGroups(restaurantId: string, productId: string) {
    const product = await ProductModel.findOne({ _id: productId, restaurant: restaurantId, isAvailable: true })
      .populate('modifierGroups')
      .populate({
        path: 'menuGroups.allowedProducts',
        select: '_id name isAvailable imageUrl',
      });
    if (!product) throw new NotFoundError('Product');

    const productObj = product.toObject() as unknown as Record<string, unknown>;

    if (product.accompanimentCategories?.length) {
      const companions = await ProductModel.find({
        restaurant: restaurantId,
        category: { $in: product.accompanimentCategories },
        isAvailable: true,
      }).select('_id name price imageUrl description estimatedTime isAvailable category isCompanion').lean();

      productObj.accompanimentProducts = companions;
    }

    return productObj;
  }

  async getProducts(restaurantId: string, categoryId?: string, includeUnavailable = false) {
    const query: Record<string, unknown> = { restaurant: restaurantId, isCompanion: { $ne: true } };
    if (categoryId) query.category = categoryId;
    if (!includeUnavailable) query.isAvailable = true;
    return ProductModel.find(query)
      .populate('category', 'name')
      .populate('modifierGroups')
      .sort({ order: 1, name: 1 });
  }

  async getProductsPaginated(restaurantId: string, page: number, limit: number, search?: string, categoryId?: string) {
    const query: Record<string, unknown> = { restaurant: restaurantId };
    if (categoryId) query.category = categoryId;
    if (search) query.name = { $regex: search, $options: 'i' };
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      ProductModel.find(query).populate('category', 'name').skip(skip).limit(limit).sort({ order: 1 }),
      ProductModel.countDocuments(query),
    ]);
    return { data, total };
  }

  async updateProduct(id: string, restaurantId: string, data: Partial<CreateProductInput>) {
    const product = await ProductModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { $set: data },
      { new: true }
    );
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  async toggleAvailability(id: string, restaurantId: string) {
    const product = await ProductModel.findOne({ _id: id, restaurant: restaurantId });
    if (!product) throw new NotFoundError('Product');
    product.isAvailable = !product.isAvailable;
    await product.save();
    return product;
  }

  async deleteProduct(id: string, restaurantId: string) {
    const product = await ProductModel.findOneAndDelete({ _id: id, restaurant: restaurantId });
    if (!product) throw new NotFoundError('Product');
    return product;
  }

  // Modifier Groups
  async createModifierGroup(restaurantId: string, data: CreateModifierGroupInput) {
    return ModifierGroupModel.create({ ...data, restaurant: restaurantId });
  }

  async getModifierGroups(restaurantId: string) {
    return ModifierGroupModel.find({ restaurant: restaurantId, isActive: true });
  }

  async updateModifierGroup(id: string, restaurantId: string, data: Partial<CreateModifierGroupInput>) {
    const group = await ModifierGroupModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { $set: data },
      { new: true }
    );
    if (!group) throw new NotFoundError('ModifierGroup');
    return group;
  }

  async deleteModifierGroup(id: string, restaurantId: string) {
    const group = await ModifierGroupModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { isActive: false },
      { new: true }
    );
    if (!group) throw new NotFoundError('ModifierGroup');
    return group;
  }
}

export const menuService = new MenuService();
