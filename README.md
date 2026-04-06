# Commy - SaaS de Pedidos para Restaurantes

Sistema SaaS moderno para restaurantes que permite a los comensales escanear un QR en su mesa, ver el menú digital y realizar pedidos compartidos en tiempo real.

---

## Arquitectura del proyecto

```
commy/
├── backend/              # API REST + Socket.IO (Node.js + TypeScript + Express)
├── frontend-admin/       # Dashboard restaurante + Super Admin (React + TypeScript)
├── frontend-usuario/     # App comensal mobile-first (React + TypeScript)
└── docker-compose.yml    # Orquestación de servicios
```

---

## Stack tecnológico

### Backend
| Tecnología | Uso |
|------------|-----|
| Node.js + TypeScript | Runtime y tipado estático |
| Express | Framework HTTP |
| MongoDB + Mongoose | Base de datos y ODM |
| Socket.IO | Tiempo real bidireccional |
| JWT (access + refresh) | Autenticación segura |
| bcryptjs | Hash de contraseñas |
| Zod | Validación de datos |
| QRCode | Generación de QRs |
| PDFKit | Exportación de QRs a PDF |
| Helmet + CORS + Rate Limit | Seguridad |

### Frontend Admin
| Tecnología | Uso |
|------------|-----|
| React 18 + TypeScript | UI framework |
| Tailwind CSS | Estilos utility-first |
| Zustand | Estado global |
| React Query | Estado del servidor + caché |
| React Hook Form + Zod | Formularios con validación |
| Socket.IO Client | Tiempo real |
| Recharts | Gráficos y analítica |
| Lucide React | Iconos |

### Frontend Comensal
| Tecnología | Uso |
|------------|-----|
| React 18 + TypeScript | UI framework |
| Tailwind CSS | Estilos mobile-first |
| Zustand | Sesión y pedido local |
| Framer Motion | Animaciones |
| Socket.IO Client | Real-time updates |
| Lucide React | Iconos |

---

## Instalación y configuración

### Prerrequisitos
- Node.js >= 18
- MongoDB (local o Atlas)
- npm o yarn

### 1. Clonar el repositorio

```bash
git clone <repo-url>
cd commy
```

### 2. Configurar el Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus valores
npm install
npm run seed    # Crear datos de ejemplo
npm run dev     # Iniciar en desarrollo
```

### 3. Configurar Frontend Admin

```bash
cd frontend-admin
cp .env.example .env
# Editar VITE_API_URL y VITE_SOCKET_URL
npm install
npm run dev
```

### 4. Configurar Frontend Comensal

```bash
cd frontend-usuario
cp .env.example .env
# Editar VITE_API_URL y VITE_SOCKET_URL
npm install
npm run dev
```

---

## Variables de entorno

### Backend (.env)

```env
# Servidor
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/commy

# JWT
JWT_ACCESS_SECRET=tu_secret_muy_largo_y_seguro_access
JWT_REFRESH_SECRET=tu_secret_muy_largo_y_seguro_refresh
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# URLs de los frontends (para CORS)
CUSTOMER_APP_URL=http://localhost:5174
ADMIN_APP_URL=http://localhost:5173

# Super Admin inicial
SUPERADMIN_EMAIL=superadmin@commy.io
SUPERADMIN_PASSWORD=Admin1234!
SUPERADMIN_USERNAME=superadmin
```

### Frontend Admin (.env)

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

### Frontend Comensal (.env)

```env
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## Scripts disponibles

### Backend
```bash
npm run dev       # Servidor con hot-reload (nodemon + ts-node)
npm run build     # Compilar TypeScript
npm start         # Producción (requiere build previo)
npm run seed      # Ejecutar seeders de datos de ejemplo
npm run lint      # ESLint
```

### Frontend Admin / Comensal
```bash
npm run dev       # Vite dev server
npm run build     # Build de producción
npm run preview   # Preview del build
npm run lint      # ESLint
```

---

## Puertos por defecto

| Servicio | Puerto | URL |
|----------|--------|-----|
| Backend API | 5000 | http://localhost:5000 |
| Frontend Admin | 5173 | http://localhost:5173 |
| Frontend Comensal | 5174 | http://localhost:5174 |
| MongoDB | 27017 | mongodb://localhost:27017 |

---

## Perfiles de usuario

### Super Admin
- Acceso completo al sistema SaaS
- CRUD de restaurantes
- Activar/suspender restaurantes
- Crear usuarios admin para cada restaurante
- Credenciales: configuradas en `.env` o seed

### Admin/Owner del Restaurante
- Dashboard con métricas del día
- Gestión de mesas, zonas y QRs
- Gestión del menú (categorías, productos, modificadores)
- Panel de pedidos en tiempo real
- Panel de cocina (KDS)
- Gestión de usuarios del staff

### Staff del Restaurante
- **Caja (cashier)**: Ver pedidos, cobrar, cerrar mesas
- **Cocina (kitchen)**: Ver pedidos confirmados, cambiar estados
- **Mozo (waiter)**: Apoyo en atención, ver mesas y llamados

### Comensal (sin login)
- Escanea QR → accede al menú de su mesa
- Alias opcional (ej: "Carlos", "Ana")
- Agrega productos al pedido compartido de la mesa
- Ve en tiempo real lo que agregan otros comensales
- Puede editar/eliminar lo suyo antes de que se confirme
- Botones de asistencia: llamar mozo, pedir cuenta, ayuda

---

## Flujo de pedidos

```
Mesa libre
    ↓ (comensal escanea QR)
Pedido creado (draft) ← otros comensales se unen
    ↓ (agrega ítems en tiempo real)
Pedido editable (draft / pending_confirmation)
    ↓ (restaurante confirma)
Pedido confirmado → Va a cocina
    ↓
En preparación
    ↓
Listo
    ↓
Servido
    ↓
Cobrado (billed)
    ↓
Cerrado (closed)
```

**Estados del pedido:**
| Estado | Editable | Descripción |
|--------|----------|-------------|
| `draft` | ✅ | Comensales agregando ítems |
| `pending_confirmation` | ✅ | Esperando que restaurante confirme |
| `confirmed` | ❌ | Pasa a cocina |
| `preparing` | ❌ | En preparación |
| `ready` | ❌ | Listo para servir |
| `served` | ❌ | Entregado |
| `billed` | ❌ | Cobrado |
| `closed` | ❌ | Mesa cerrada |
| `cancelled` | ❌ | Cancelado |

---

## Endpoints de la API

### Autenticación
```
POST   /api/v1/auth/login          Login con usuario/contraseña
POST   /api/v1/auth/refresh        Refresh del access token
POST   /api/v1/auth/logout         Cerrar sesión
GET    /api/v1/auth/me             Info del usuario autenticado
```

### Super Admin
```
GET    /api/v1/admin/restaurants   Listar restaurantes
POST   /api/v1/admin/restaurants   Crear restaurante
PATCH  /api/v1/admin/restaurants/:id   Actualizar
PATCH  /api/v1/admin/restaurants/:id/toggle-status  Activar/suspender
```

### Restaurantes (Admin)
```
GET    /api/v1/restaurants/me      Info del restaurante propio
PATCH  /api/v1/restaurants/me      Actualizar configuración
```

### Mesas
```
GET    /api/v1/tables              Listar mesas del restaurante
POST   /api/v1/tables              Crear mesa
PATCH  /api/v1/tables/:id          Actualizar
DELETE /api/v1/tables/:id          Eliminar
GET    /api/v1/tables/:id/qr       Obtener QR de la mesa
POST   /api/v1/tables/export-pdf   Exportar QRs a PDF
GET    /api/v1/tables/token/:token Validar token de QR (público)
```

### Menú
```
GET    /api/v1/menu/categories                    Categorías
POST   /api/v1/menu/categories                    Crear categoría
PATCH  /api/v1/menu/categories/:id                Actualizar
DELETE /api/v1/menu/categories/:id                Eliminar
GET    /api/v1/menu/products                      Productos (paginado)
POST   /api/v1/menu/products                      Crear producto
PATCH  /api/v1/menu/products/:id                  Actualizar
PATCH  /api/v1/menu/products/:id/toggle-availability Agotado/disponible
DELETE /api/v1/menu/products/:id                  Eliminar
GET    /api/v1/menu/:restaurantId/categories      Categorías (público, para comensal)
GET    /api/v1/menu/:restaurantId/products        Productos (público, para comensal)
```

### Pedidos
```
POST   /api/v1/orders/join-table               Unirse/crear pedido de mesa
GET    /api/v1/orders                          Listar pedidos (staff)
GET    /api/v1/orders/live                     Pedidos activos en tiempo real
GET    /api/v1/orders/:id                      Detalle del pedido
POST   /api/v1/orders/:id/items                Agregar ítem
PATCH  /api/v1/orders/:id/items/:itemId        Actualizar ítem
DELETE /api/v1/orders/:id/items/:itemId        Eliminar ítem
PATCH  /api/v1/orders/:id/status               Cambiar estado (staff)
```

### Notificaciones / Asistencia
```
POST   /api/v1/notifications                   Crear llamado (comensal)
GET    /api/v1/notifications                   Listar llamados (staff)
PATCH  /api/v1/notifications/:id/resolve       Marcar resuelto
```

### Usuarios / Staff
```
GET    /api/v1/users                   Usuarios del restaurante
POST   /api/v1/users                   Crear usuario de staff
PATCH  /api/v1/users/:id               Actualizar
PATCH  /api/v1/users/:id/toggle-status Activar/desactivar
```

---

## Eventos Socket.IO

### Rooms disponibles
| Room | Quién se une |
|------|-------------|
| `restaurant:{restaurantId}` | Todo el staff del restaurante |
| `table:{tableId}` | Comensales + staff de esa mesa |
| `kitchen:{restaurantId}` | Staff de cocina |

### Eventos emitidos por el servidor
| Evento | Room | Payload |
|--------|------|---------|
| `order:created` | restaurant + table | `{order}` |
| `order:itemAdded` | restaurant + table | `{orderId, item, addedByAlias}` |
| `order:itemRemoved` | restaurant + table | `{orderId, itemId}` |
| `order:itemUpdated` | restaurant + table | `{orderId, item}` |
| `order:statusChanged` | restaurant + table | `{orderId, status, previousStatus}` |
| `notification:new` | restaurant | `{notification}` |
| `notification:resolved` | restaurant | `{notificationId}` |
| `table:statusChanged` | restaurant | `{tableId, status}` |

---

## Datos de ejemplo (seed)

Después de ejecutar `npm run seed` en el backend:

### Super Admin
```
Username: superadmin
Password: Admin1234!
```

### Restaurante de ejemplo
```
Nombre: La Terraza Restaurante
Slug: la-terraza
```

### Admin del restaurante
```
Username: admin_terraza
Password: Admin1234!
Role: owner
```

### Staff de ejemplo
```
Username: cajero1 / Password: Staff1234! / Role: cashier
Username: cocina1 / Password: Staff1234! / Role: kitchen
```

---

## Arquitectura y decisiones técnicas

### Manejo de concurrencia (una sola orden por mesa)
Se usa un enfoque de bloqueo lógico en MongoDB:
1. Al unirse a una mesa, se busca primero una orden activa (`status: {$in: ['draft', 'pending_confirmation']}`)
2. Si existe, el cliente se une a esa orden
3. Si no existe, se crea una nueva usando operaciones atómicas para evitar race conditions
4. El `tableId` + estado de la orden actúan como mutex lógico

### Tokens de QR
Cada mesa tiene un `qrCode` único (UUID v4) que no expone el ID interno de MongoDB. 
La URL del QR es: `{CUSTOMER_APP_URL}/mesa/{qrToken}`

### Refresh Token Strategy
- Access token: 15 minutos, en memoria del cliente
- Refresh token: 7 días, en localStorage (o httpOnly cookie en producción)
- El refresh token se hashea antes de guardarse en DB
- En 401, el interceptor de Axios intenta refresh automático

### Estado en tiempo real
- El backend emite eventos a rooms específicos
- Los clientes se suscriben al room de su mesa/restaurante
- No se usa polling, todo es event-driven

---

## Mejoras futuras sugeridas

1. **División de cuenta**: Calcular cuánto paga cada comensal según lo que pidió
2. **Pagos online**: Integración con Stripe/MercadoPago para pago desde el celular
3. **Multi-sucursal**: Un restaurante puede tener múltiples branches
4. **Analítica avanzada**: Dashboard con ventas por día/semana/mes, productos más vendidos, horas pico
5. **Sistema de promociones**: Descuentos, combos, happy hour automático
6. **Historial de pedidos por cliente**: Si el cliente se registra, ver su historial
7. **Auditoría de acciones**: Log de quién hizo qué cambio y cuándo
8. **Notificaciones push**: Usando service workers para alertas en cocina
9. **Modo offline**: Service worker para menú offline
10. **Integración con impresoras**: Imprimir ticket automáticamente al confirmar
11. **Sistema de reservas**: Reservar mesa con anticipación
12. **Valoraciones y feedback**: Comensal puede calificar productos

---

## Licencia

MIT - Ver LICENSE para más detalles.
