import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { UserModel } from '../users/user.model';
import { CustomerModel } from '../customers/customer.model';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.utils';
import { comparePassword } from '../../utils/password.utils';
import { UnauthorizedError, NotFoundError } from '../../common/errors/AppError';
import { AuthPayload } from '../../common/types';
import { SALT_ROUNDS } from '../../config/constants';
import { env } from '../../config/env';

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export class AuthService {
  async login(login: string, password: string) {
    const user = await UserModel.findOne({
      $or: [{ email: login.toLowerCase() }, { username: login.toLowerCase() }],
      isActive: true,
    }).select('+passwordHash +refreshTokenHash');

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }
    console.log(user);
    const isValid = await comparePassword(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const payload: AuthPayload = {
      userId: user._id.toString(),
      role: user.role,
      restaurantId: user.restaurant?.toString(),
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    user.refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    user.lastLoginAt = new Date();
    await user.save();

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurant,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: AuthPayload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = await UserModel.findById(payload.userId)
      .select('+refreshTokenHash')
      .where({ isActive: true });

    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const newPayload: AuthPayload = {
      userId: user._id.toString(),
      role: user.role,
      restaurantId: user.restaurant?.toString(),
    };

    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    user.refreshTokenHash = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);
    await user.save();

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(userId: string) {
    await UserModel.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }

  async me(userId: string) {
    const user = await UserModel.findById(userId).populate('restaurant', 'name slug logo settings');
    if (!user) throw new NotFoundError('User');
    return user;
  }

  async googleCustomerLogin(credential: string, restaurantId?: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new UnauthorizedError('Invalid Google token');
    }

    const { sub: googleId, email, name, picture } = payload;

    const updateData: Record<string, unknown> = {
      email: email ?? '',
      name: name ?? email ?? 'Usuario',
      picture,
      lastSeenAt: new Date(),
    };

    if (restaurantId) {
      updateData.$addToSet = { restaurants: restaurantId };
    }

    const customer = await CustomerModel.findOneAndUpdate(
      { googleId },
      { $set: { email: updateData.email, name: updateData.name, picture: updateData.picture, lastSeenAt: updateData.lastSeenAt },
        ...(restaurantId ? { $addToSet: { restaurants: restaurantId } } : {}) },
      { upsert: true, new: true }
    );

    const token = jwt.sign(
      { customerId: customer._id.toString(), type: 'customer' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '30d' }
    );

    return {
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        email: customer.email,
        picture: customer.picture,
        phone: customer.phone,
        address: customer.address,
      },
    };
  }
}

export const authService = new AuthService();
