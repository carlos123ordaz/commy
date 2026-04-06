import { v4 as uuidv4 } from 'uuid';
import { RestaurantModel } from './restaurant.model';
import { UserModel } from '../users/user.model';
import { hashPassword } from '../../utils/password.utils';
import { CreateRestaurantInput, UpdateRestaurantInput, UpdateChannelConfigInput } from './restaurant.validators';
import { ConflictError, NotFoundError } from '../../common/errors/AppError';
import { env } from '../../config/env';
import { DEFAULT_PAGE_SIZE } from '../../config/constants';

export class RestaurantService {
  async create(data: CreateRestaurantInput) {
    const existing = await RestaurantModel.findOne({ slug: data.slug });
    if (existing) throw new ConflictError('Slug already in use');

    const emailExists = await UserModel.findOne({ email: data.adminEmail });
    if (emailExists) throw new ConflictError('Admin email already in use');

    const restaurant = await RestaurantModel.create({
      name: data.name,
      legalName: data.legalName,
      slug: data.slug,
      email: data.email,
      phone: data.phone,
      logo: data.logo,
      plan: data.plan || 'starter',
    });

    const passwordHash = await hashPassword(data.adminPassword);
    await UserModel.create({
      username: data.adminUsername,
      email: data.adminEmail,
      passwordHash,
      role: 'owner',
      restaurant: restaurant._id,
    });

    return restaurant;
  }

  async findAll(page = 1, limit = DEFAULT_PAGE_SIZE, search?: string) {
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      RestaurantModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      RestaurantModel.countDocuments(query),
    ]);
    return { data, total };
  }

  async findById(id: string) {
    const restaurant = await RestaurantModel.findById(id);
    if (!restaurant) throw new NotFoundError('Restaurant');
    return restaurant;
  }

  async update(id: string, data: UpdateRestaurantInput) {
    const restaurant = await RestaurantModel.findByIdAndUpdate(id, { $set: data }, { new: true });
    if (!restaurant) throw new NotFoundError('Restaurant');
    return restaurant;
  }

  async toggleStatus(id: string) {
    const restaurant = await RestaurantModel.findById(id);
    if (!restaurant) throw new NotFoundError('Restaurant');
    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();
    return restaurant;
  }

  async updateChannelConfig(restaurantId: string, data: UpdateChannelConfigInput) {
    const restaurant = await RestaurantModel.findById(restaurantId);
    if (!restaurant) throw new NotFoundError('Restaurant');

    if (data.delivery !== undefined) {
      const d = data.delivery;
      if (d.enabled !== undefined) restaurant.settings.delivery.enabled = d.enabled;
      if (d.fee !== undefined) restaurant.settings.delivery.fee = d.fee;
      if (d.hours !== undefined) restaurant.settings.delivery.hours = d.hours as typeof restaurant.settings.delivery.hours;
      if (d.estimatedMinutes !== undefined) restaurant.settings.delivery.estimatedMinutes = d.estimatedMinutes;
    }

    if (data.takeaway !== undefined) {
      const t = data.takeaway;
      if (t.enabled !== undefined) restaurant.settings.takeaway.enabled = t.enabled;
      if (t.fee !== undefined) restaurant.settings.takeaway.fee = t.fee;
    }

    await restaurant.save();
    return restaurant;
  }

  async generateChannelQR(restaurantId: string, channel: 'delivery' | 'takeaway') {
    const restaurant = await RestaurantModel.findById(restaurantId);
    if (!restaurant) throw new NotFoundError('Restaurant');

    // Token = restaurant ID (permanent, never expires)
    const token = restaurant._id.toString();
    const qrUrl = `${env.CUSTOMER_APP_URL}/channel/${channel}/${token}`;

    if (channel === 'delivery') {
      restaurant.settings.delivery.qrToken = token;
      restaurant.settings.delivery.qrUrl = qrUrl;
    } else {
      restaurant.settings.takeaway.qrToken = token;
      restaurant.settings.takeaway.qrUrl = qrUrl;
    }

    await restaurant.save();
    return { token, qrUrl, channel };
  }

  /** Public lookup by channel token (token = restaurant _id) */
  async findByChannelToken(token: string, channel: 'delivery' | 'takeaway') {
    // token is the restaurant _id — catch invalid ObjectId format
    let restaurant;
    try {
      restaurant = await RestaurantModel.findOne({ _id: token, isActive: true });
    } catch {
      throw new NotFoundError('QR no válido o restaurante inactivo');
    }
    if (!restaurant) throw new NotFoundError('QR no válido o restaurante inactivo');
    const channelEnabled = channel === 'delivery'
      ? restaurant.settings.delivery?.enabled
      : restaurant.settings.takeaway?.enabled;
    if (!channelEnabled) throw new NotFoundError('Este canal no está disponible');
    return restaurant;
  }

  async getStats(restaurantId: string) {
    const [tables, users] = await Promise.all([
      import('../tables/table.model').then(({ TableModel }) =>
        TableModel.countDocuments({ restaurant: restaurantId })
      ),
      UserModel.countDocuments({ restaurant: restaurantId, isActive: true }),
    ]);
    return { tables, users };
  }
}

export const restaurantService = new RestaurantService();
