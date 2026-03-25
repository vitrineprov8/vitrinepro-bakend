# VitrinePro Backend — Project Overview

## Qué es

API REST del backend de VitrinePro, una plataforma SaaS de portfolios profesionales. Gestiona usuarios, perfiles, ítems de portfolio, educación, CVs, etiquetas y almacenamiento de archivos.

**Deploy:** Railway
**URL Producción:** https://vitrinepro-bakend-production.up.railway.app

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | 11.0.1 | Framework principal |
| Node.js + TypeScript | — | Runtime + tipado |
| Express | — | HTTP layer (vía @nestjs/platform-express) |
| PostgreSQL | — | Base de datos principal |
| TypeORM | 0.3.28 | ORM |
| Passport.js + JWT | — | Autenticación |
| bcryptjs | 3.0.3 | Hash de contraseñas |
| AWS S3 / Cloudflare R2 | — | Almacenamiento de archivos |
| Sharp | 0.34.5 | Procesamiento de imágenes |
| Multer | — | Upload de archivos |
| Slugify | 1.6.6 | Generación de slugs |
| class-validator | — | Validación de DTOs |

---

## Arquitectura

### Patrón modular NestJS

Cada dominio de negocio tiene su propio módulo con:
- **Entity** — entidad TypeORM (tabla de BD)
- **DTO** — clases de validación de input
- **Service** — lógica de negocio
- **Controller** — rutas HTTP
- **Module** — inyección de dependencias

### Estructura de directorios

```
src/
├── auth/          # Autenticación (local + OAuth Google/LinkedIn)
├── users/         # Gestión de usuarios
├── profile/       # Perfil público/privado
├── portfolio/     # Ítems de portfolio (proyectos/artículos)
├── education/     # Formación académica y certificaciones
├── cv/            # Gestión de archivos CV
├── tags/          # Etiquetas para categorizar portfolio
├── storage/       # Servicio AWS S3/R2
├── uploads/       # Endpoint genérico de upload
├── database/      # Configuración de TypeORM
├── common/        # Helpers compartidos (paginación)
├── app.module.ts  # Módulo raíz
└── main.ts        # Entry point (puerto 3000)
```

---

## Base de Datos (PostgreSQL + TypeORM)

### Entidades

**`users`**
- id, email, firstName, lastName, password (nullable, bcrypt)
- authProvider: `local | google | linkedin`
- username (único, auto-generado)
- profession, bio, phone, website, location
- avatarUrl, avatarKey, bannerColor
- socialLinks (JSONB): linkedin, github, twitter, instagram, etc.
- isActive, createdAt, updatedAt

**`portfolio_items`**
- id, userId (FK), title, subtitle, slug (único)
- content (JSONB — contenido Tiptap)
- coverImageUrl, coverImageKey
- clientName, year, duration, role
- projectStatus: `ONGOING | COMPLETED | PAUSED | CANCELLED`
- status: `DRAFT | PUBLISHED`
- externalUrl
- Relaciones: tags (M2M), files (1-to-many)

**`portfolio_files`**
- id, portfolioItemId (FK)
- fileUrl, fileKey, fileType: `IMAGE | PDF`
- caption, originalFilename, fileSize, order

**`educations`**
- id, userId (FK)
- type: `GRADUATE | POST_GRADUATE | MASTER | DOCTORATE | CERTIFICATION | COURSE`
- institution, title, fieldOfStudy
- startDate, endDate, description
- certificateUrl, certificateKey, order

**`tags`**
- id, userId (FK), name, slug
- Unique constraint: (userId, slug)

**`cvs`**
- id, userId (FK), label, fileUrl, fileKey, isActive

---

## API Endpoints

### Auth (`/auth`)
```
POST /auth/register          # Registro email/password
POST /auth/login             # Login email/password
GET  /auth/profile           # Perfil del usuario autenticado (JWT)
GET  /auth/google            # Iniciar OAuth Google
GET  /auth/google/callback   # Callback Google
GET  /auth/linkedin          # Iniciar OAuth LinkedIn
GET  /auth/linkedin/callback # Callback LinkedIn
```

### Profile (`/profile`)
```
GET   /profile/me            # Perfil privado completo (JWT)
GET   /profile/:username     # Perfil público por username
PATCH /profile               # Actualizar perfil (JWT)
POST  /profile/avatar        # Upload avatar (JWT)
```

### Portfolio (`/portfolio`)
```
GET    /portfolio                        # Listar ítems (paginado)
GET    /portfolio/:slug                  # Obtener ítem por slug
POST   /portfolio                        # Crear ítem (JWT)
PATCH  /portfolio/:id                    # Actualizar ítem (JWT)
DELETE /portfolio/:id                    # Eliminar ítem (JWT)
POST   /portfolio/:id/cover              # Upload cover (JWT)
POST   /portfolio/:id/files              # Agregar archivo (JWT)
DELETE /portfolio/:id/files/:fileId      # Eliminar archivo (JWT)
PATCH  /portfolio/:id/files/reorder      # Reordenar archivos (JWT)
```

### Education (`/education`)
```
GET    /education                    # Registros del usuario (JWT)
GET    /education/public/:userId     # Registros públicos
POST   /education                    # Crear (JWT)
PATCH  /education/:id               # Actualizar (JWT)
DELETE /education/:id               # Eliminar (JWT)
POST   /education/:id/certificate   # Upload certificado (JWT)
```

### CV (`/cv`)
```
GET    /cv                   # CVs del usuario (JWT)
GET    /cv/public/:userId    # CVs públicos
POST   /cv                   # Upload CV (JWT)
PATCH  /cv/:id              # Actualizar metadatos (JWT)
DELETE /cv/:id              # Eliminar (JWT)
GET    /cv/:id/download     # URL de descarga
```

### Tags (`/tags`)
```
GET    /tags       # Tags del usuario (JWT)
POST   /tags       # Crear tag (JWT)
DELETE /tags/:id   # Eliminar tag (JWT)
```

### Uploads (`/uploads`)
```
POST /uploads/image   # Upload imagen para contenido rico (JWT)
```

---

## Autenticación

### Guards disponibles
| Guard | Descripción |
|---|---|
| `JwtAuthGuard` | Requiere JWT válido |
| `GoogleAuthGuard` | Passport OAuth Google |
| `LinkedInAuthGuard` | Passport OAuth LinkedIn |
| `OptionalJwtAuthGuard` | JWT opcional (para chequear ownership) |

### Flujo OAuth
1. Frontend redirige a `/auth/google` o `/auth/linkedin`
2. Provider autentica al usuario
3. Callback: si el email ya existe → se vincula la cuenta; si no → se crea usuario nuevo
4. Se crean tags por defecto: "Artigo" y "Projeto"
5. Se genera JWT → redirect al frontend con `?token=...`

### JWT
- Payload: `{ sub: userId, email }`
- Header: `Authorization: Bearer <token>`
- Secret: `JWT_SECRET` env var

---

## Almacenamiento de Archivos (S3 / Cloudflare R2)

### Procesamiento de imágenes con Sharp
| Tipo | Dimensiones | Formato | Calidad |
|---|---|---|---|
| Avatar | 400×400px | WebP | 82 |
| Banner | 1920×600px | WebP | — |
| Cover | 1280×720px | WebP | — |
| Contenido | 1280×960px | WebP | — |

- Metadata EXIF eliminada (privacidad)
- URLs con cache-busting: `?v=timestamp`

### Estructura de keys en S3
```
avatars/{userId}.webp
portfolio/{portfolioItemId}/{fileId}.webp
education/{educationId}/{certificateId}.pdf
cvs/{userId}/{cvId}.pdf
content/{userId}/{uuid}.webp
```

### Límites
- Imágenes (JPEG, PNG, WebP, GIF): máx 8MB
- PDFs: máx 20MB

---

## Configuración del servidor (main.ts)

```typescript
Puerto: 3000 (process.env.PORT)
CORS origins:
  - http://localhost:3000
  - http://localhost:4321
  - https://www.v8pro.com.br
  - https://v8pro.com.br
Validation pipe: whitelist=true, transform=true
```

---

## Variables de Entorno

```env
# Base de datos
DATABASE_URL=postgresql://user:pass@host:5432/vitronepro

# JWT
JWT_SECRET=super-secret-key

# OAuth Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://www.v8pro.com.br/auth/google/callback

# OAuth LinkedIn
LINKEDIN_CLIENT_ID=...
LINKEDIN_CLIENT_SECRET=...
LINKEDIN_CALLBACK_URL=https://www.v8pro.com.br/auth/linkedin/callback

# Cloudflare R2 / AWS S3
R2_ENDPOINT=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...

# App
FRONTEND_URL=https://www.v8pro.com.br
NODE_ENV=production
PORT=3000
```

Ver `.env.example` para template completo.

---

## Comandos

```bash
npm run start:dev    # Dev con watch (ts-node)
npm run build        # Compilar TypeScript → dist/
npm start            # Producción (dist/main)
npm test             # Unit tests (Jest)
npm run test:e2e     # Tests end-to-end
npm run lint         # ESLint + auto-fix
```

---

## Patrones y Convenciones

1. **DTOs** con `class-validator` para toda entrada de datos
2. **Services** contienen la lógica de negocio; controllers solo orquestan
3. **Repository pattern** via TypeORM
4. **HTTP Exceptions** semánticas: `NotFoundException`, `ForbiddenException`, `BadRequestException`
5. **Módulos feature** auto-contenidos (entity + dto + service + controller + module)
6. **Ownership check**: antes de cualquier CRUD, verificar que el recurso pertenece al usuario autenticado
7. **Cleanup**: al actualizar imagen, eliminar la anterior de S3

---

## Archivos clave

| Archivo | Propósito |
|---|---|
| `src/main.ts` | Entry point, CORS, validation pipe |
| `src/app.module.ts` | Módulo raíz, importa todos los feature modules |
| `src/database/database.config.ts` | Config TypeORM |
| `src/auth/auth.service.ts` | Lógica de registro, login, OAuth |
| `src/storage/storage.service.ts` | Upload/delete/processing de archivos |
| `src/portfolio/portfolio.service.ts` | CRUD portfolio con paginación |
| `.env.example` | Template de variables de entorno |
| `Vitronepro_API.postman_collection.json` | Colección Postman con todos los endpoints |
| `ARQUITECTURA.md` | Documentación adicional de arquitectura |
