import { UserModel } from './user.model';
import { hashPassword } from '../../utils/password.utils';
import { CreateUserInput, UpdateUserInput } from './user.validators';
import { ConflictError, NotFoundError } from '../../common/errors/AppError';

export class UserService {
  async create(restaurantId: string, data: CreateUserInput) {
    const exists = await UserModel.findOne({
      $or: [{ email: data.email }, { username: data.username, restaurant: restaurantId }],
    });
    if (exists) throw new ConflictError('Username or email already in use');

    const passwordHash = await hashPassword(data.password);
    const user = await UserModel.create({
      username: data.username,
      email: data.email,
      passwordHash,
      role: data.role,
      restaurant: restaurantId,
    });
    return user;
  }

  async findAll(restaurantId: string) {
    return UserModel.find({ restaurant: restaurantId }).sort({ createdAt: -1 }).select('-passwordHash -refreshTokenHash');
  }

  async findById(id: string, restaurantId: string) {
    const user = await UserModel.findOne({ _id: id, restaurant: restaurantId }).select('-passwordHash -refreshTokenHash');
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async update(id: string, restaurantId: string, data: UpdateUserInput) {
    const updateData: Record<string, unknown> = { ...data };
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
      delete updateData.password;
    }
    const user = await UserModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { $set: updateData },
      { new: true }
    ).select('-passwordHash -refreshTokenHash');
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async toggleStatus(id: string, restaurantId: string) {
    const user = await UserModel.findOne({ _id: id, restaurant: restaurantId });
    if (!user) throw new NotFoundError('User');
    user.isActive = !user.isActive;
    await user.save();
    return user;
  }
}

export const userService = new UserService();
