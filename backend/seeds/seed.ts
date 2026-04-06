import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../src/modules/users/user.model';
import { RestaurantModel } from '../src/modules/restaurants/restaurant.model';
import { TableModel } from '../src/modules/tables/table.model';
import { CategoryModel } from '../src/modules/menu/category.model';
import { ProductModel } from '../src/modules/menu/product.model';
import { ModifierGroupModel } from '../src/modules/menu/modifierGroup.model';
import { hashPassword } from '../src/utils/password.utils';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/commy';
const CUSTOMER_APP_URL = process.env.CUSTOMER_APP_URL || 'http://localhost:5174';

async function seed() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clean
  await Promise.all([
    UserModel.deleteMany({}),
    RestaurantModel.deleteMany({}),
    TableModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    ProductModel.deleteMany({}),
    ModifierGroupModel.deleteMany({}),
  ]);
  console.log('Database cleaned');

  // Super Admin
  const superAdminHash = await hashPassword(process.env.SUPERADMIN_PASSWORD || 'Admin1234!');
  const superAdmin = await UserModel.create({
    username: process.env.SUPERADMIN_USERNAME || 'superadmin',
    email: process.env.SUPERADMIN_EMAIL || 'superadmin@commy.io',
    passwordHash: superAdminHash,
    role: 'superadmin',
    isActive: true,
  });
  console.log(`✅ Super Admin: ${superAdmin.username}`);

  // Restaurant
  const restaurant = await RestaurantModel.create({
    name: 'La Terraza Restaurante',
    legalName: 'La Terraza S.A.C.',
    slug: 'la-terraza',
    email: 'contacto@laterraza.com',
    phone: '+51 999 123 456',
    plan: 'pro',
    isActive: true,
    settings: {
      currency: 'PEN',
      timezone: 'America/Lima',
      acceptingOrders: true,
      primaryColor: '#6366F1',
    },
  });
  console.log(`✅ Restaurant: ${restaurant.name}`);

  // Owner user
  const ownerHash = await hashPassword('Admin1234!');
  const owner = await UserModel.create({
    username: 'admin_terraza',
    email: 'admin@laterraza.com',
    passwordHash: ownerHash,
    role: 'owner',
    restaurant: restaurant._id,
    isActive: true,
  });
  console.log(`✅ Owner: ${owner.username}`);

  // Staff users
  const staffHash = await hashPassword('Staff1234!');
  await UserModel.insertMany([
    {
      username: 'cajero1',
      email: 'cajero@laterraza.com',
      passwordHash: staffHash,
      role: 'cashier',
      restaurant: restaurant._id,
      isActive: true,
    },
    {
      username: 'cocina1',
      email: 'cocina@laterraza.com',
      passwordHash: staffHash,
      role: 'kitchen',
      restaurant: restaurant._id,
      isActive: true,
    },
    {
      username: 'mozo1',
      email: 'mozo@laterraza.com',
      passwordHash: staffHash,
      role: 'waiter',
      restaurant: restaurant._id,
      isActive: true,
    },
  ]);
  console.log('✅ Staff users created');

  // Tables
  const zones = ['Terraza', 'Interior', 'Bar'];
  const tableData = [
    { name: 'Mesa 1', number: 1, capacity: 4, zone: 'Terraza' },
    { name: 'Mesa 2', number: 2, capacity: 2, zone: 'Terraza' },
    { name: 'Mesa 3', number: 3, capacity: 6, zone: 'Interior' },
    { name: 'Mesa 4', number: 4, capacity: 4, zone: 'Interior' },
    { name: 'Mesa 5', number: 5, capacity: 2, zone: 'Bar' },
    { name: 'Mesa 6', number: 6, capacity: 4, zone: 'Interior' },
    { name: 'Mesa 7', number: 7, capacity: 8, zone: 'Interior' },
    { name: 'Barra 1', number: 8, capacity: 2, zone: 'Bar' },
  ];

  const tables = await Promise.all(
    tableData.map((t) => {
      const qrCode = uuidv4();
      return TableModel.create({
        ...t,
        restaurant: restaurant._id,
        qrCode,
        qrUrl: `${CUSTOMER_APP_URL}/mesa/${qrCode}`,
        status: 'free',
        isActive: true,
      });
    })
  );
  console.log(`✅ ${tables.length} Tables created`);

  // Modifier groups
  const drinkOptions = await ModifierGroupModel.create({
    restaurant: restaurant._id,
    name: 'Tamaño de bebida',
    required: true,
    multipleSelection: false,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { name: 'Pequeño', priceAdd: 0, isAvailable: true },
      { name: 'Mediano', priceAdd: 2, isAvailable: true },
      { name: 'Grande', priceAdd: 4, isAvailable: true },
    ],
    isActive: true,
  });

  const burgerExtras = await ModifierGroupModel.create({
    restaurant: restaurant._id,
    name: 'Extras para hamburguesa',
    required: false,
    multipleSelection: true,
    minSelections: 0,
    maxSelections: 5,
    options: [
      { name: 'Doble carne', priceAdd: 5, isAvailable: true },
      { name: 'Queso extra', priceAdd: 2, isAvailable: true },
      { name: 'Bacon', priceAdd: 3, isAvailable: true },
      { name: 'Aguacate', priceAdd: 2, isAvailable: true },
      { name: 'Huevo frito', priceAdd: 1.5, isAvailable: true },
    ],
    isActive: true,
  });

  const cookingPoint = await ModifierGroupModel.create({
    restaurant: restaurant._id,
    name: 'Punto de cocción',
    required: true,
    multipleSelection: false,
    minSelections: 1,
    maxSelections: 1,
    options: [
      { name: 'Término 3/4', priceAdd: 0, isAvailable: true },
      { name: 'Término medio', priceAdd: 0, isAvailable: true },
      { name: 'Bien cocido', priceAdd: 0, isAvailable: true },
    ],
    isActive: true,
  });
  console.log('✅ Modifier groups created');

  // Categories
  const categories = await CategoryModel.insertMany([
    { restaurant: restaurant._id, name: 'Entradas', order: 1, isActive: true },
    { restaurant: restaurant._id, name: 'Carnes & Parrilla', order: 2, isActive: true },
    { restaurant: restaurant._id, name: 'Hamburguesas', order: 3, isActive: true },
    { restaurant: restaurant._id, name: 'Ensaladas', order: 4, isActive: true },
    { restaurant: restaurant._id, name: 'Pastas', order: 5, isActive: true },
    { restaurant: restaurant._id, name: 'Postres', order: 6, isActive: true },
    { restaurant: restaurant._id, name: 'Bebidas', order: 7, isActive: true },
  ]);
  const [catEntradas, catCarnes, catHamburguesas, catEnsaladas, catPastas, catPostres, catBebidas] = categories;
  console.log(`✅ ${categories.length} Categories created`);

  // Products
  await ProductModel.insertMany([
    // Entradas
    { restaurant: restaurant._id, category: catEntradas._id, name: 'Tabla de quesos y embutidos', description: 'Selección de quesos artesanales con jamón ibérico y pan tostado', price: 28, isAvailable: true, estimatedTime: 10, order: 1 },
    { restaurant: restaurant._id, category: catEntradas._id, name: 'Croquetas caseras', description: 'Croquetas de jamón y queso con salsa de tomate especial', price: 18, isAvailable: true, estimatedTime: 8, order: 2 },
    { restaurant: restaurant._id, category: catEntradas._id, name: 'Nachos con guacamole', description: 'Nachos crujientes con guacamole fresco, crema y jalapeños', price: 22, isAvailable: true, estimatedTime: 7, order: 3 },

    // Carnes
    { restaurant: restaurant._id, category: catCarnes._id, name: 'Bife de chorizo 350g', description: 'Corte premium a la parrilla con papas fritas y ensalada', price: 65, isAvailable: true, estimatedTime: 20, modifierGroups: [cookingPoint._id], order: 1 },
    { restaurant: restaurant._id, category: catCarnes._id, name: 'Lomo saltado', description: 'Clásico peruano con carne de res, tomate, cebolla y papas fritas', price: 45, isAvailable: true, estimatedTime: 15, order: 2 },
    { restaurant: restaurant._id, category: catCarnes._id, name: 'Pollo a la plancha', description: 'Pechuga de pollo marinada con hierbas, papas y verduras', price: 38, isAvailable: true, estimatedTime: 15, order: 3 },

    // Hamburguesas
    { restaurant: restaurant._id, category: catHamburguesas._id, name: 'Classic Burger', description: '180g carne de res, lechuga, tomate, cebolla y salsa especial', price: 32, isAvailable: true, estimatedTime: 12, modifierGroups: [burgerExtras._id], order: 1 },
    { restaurant: restaurant._id, category: catHamburguesas._id, name: 'BBQ Burger', description: '200g carne de res con salsa BBQ, bacon crujiente y queso cheddar', price: 38, isAvailable: true, estimatedTime: 14, modifierGroups: [burgerExtras._id], order: 2 },
    { restaurant: restaurant._id, category: catHamburguesas._id, name: 'Veggie Burger', description: 'Medallón de garbanzos y quinoa, vegetales frescos y mayonesa vegana', price: 30, isAvailable: true, estimatedTime: 10, order: 3 },

    // Ensaladas
    { restaurant: restaurant._id, category: catEnsaladas._id, name: 'César con pollo', description: 'Lechuga romana, pollo grillado, crutones, queso parmesano y aderezo César', price: 25, isAvailable: true, estimatedTime: 8, order: 1 },
    { restaurant: restaurant._id, category: catEnsaladas._id, name: 'Mediterránea', description: 'Mix de verdes, tomate cherry, aceitunas, feta y aderezo de limón', price: 22, isAvailable: true, estimatedTime: 7, order: 2 },

    // Pastas
    { restaurant: restaurant._id, category: catPastas._id, name: 'Spaghetti Carbonara', description: 'Pasta con huevo, panceta, queso parmesano y pimienta negra', price: 35, isAvailable: true, estimatedTime: 15, order: 1 },
    { restaurant: restaurant._id, category: catPastas._id, name: 'Penne Arrabiata', description: 'Salsa de tomate picante, ajo y albahaca fresca', price: 28, isAvailable: true, estimatedTime: 15, order: 2 },

    // Postres
    { restaurant: restaurant._id, category: catPostres._id, name: 'Lava cake de chocolate', description: 'Coulant tibio con centro líquido y helado de vainilla', price: 18, isAvailable: true, estimatedTime: 12, order: 1 },
    { restaurant: restaurant._id, category: catPostres._id, name: 'Tiramisu', description: 'Clásico italiano con mascarpone, café y cacao en polvo', price: 16, isAvailable: true, estimatedTime: 5, order: 2 },
    { restaurant: restaurant._id, category: catPostres._id, name: 'Cheesecake de frutos rojos', description: 'Base de galleta, crema de queso y coulis de berries', price: 16, isAvailable: true, estimatedTime: 5, order: 3 },

    // Bebidas
    { restaurant: restaurant._id, category: catBebidas._id, name: 'Gaseosa', description: 'Coca-Cola, Sprite o Inca Kola', price: 8, isAvailable: true, estimatedTime: 2, modifierGroups: [drinkOptions._id], order: 1 },
    { restaurant: restaurant._id, category: catBebidas._id, name: 'Agua mineral', description: 'Con o sin gas', price: 6, isAvailable: true, estimatedTime: 1, order: 2 },
    { restaurant: restaurant._id, category: catBebidas._id, name: 'Limonada frozen', description: 'Limonada helada con hierbabuena fresca', price: 12, isAvailable: true, estimatedTime: 5, order: 3 },
    { restaurant: restaurant._id, category: catBebidas._id, name: 'Chicha morada', description: 'Bebida tradicional peruana fría', price: 10, isAvailable: true, estimatedTime: 2, order: 4 },
    { restaurant: restaurant._id, category: catBebidas._id, name: 'Cerveza artesanal', description: 'Selección de cervezas locales: rubia, roja o negra', price: 15, isAvailable: true, estimatedTime: 2, order: 5 },
  ]);
  console.log('✅ Products created');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Credentials:');
  console.log('   Super Admin: superadmin / Admin1234!');
  console.log('   Restaurant Owner: admin_terraza / Admin1234!');
  console.log('   Cashier: cajero1 / Staff1234!');
  console.log('   Kitchen: cocina1 / Staff1234!');
  console.log('   Waiter: mozo1 / Staff1234!');
  console.log('\n🏪 Restaurant: La Terraza Restaurante (slug: la-terraza)');
  console.log(`📱 Customer URL: ${CUSTOMER_APP_URL}/mesa/{tableToken}`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
