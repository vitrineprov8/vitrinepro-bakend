# Sistema de Login - NestJS + PostgreSQL + JWT

## Requisitos Previos

1. **PostgreSQL** instalado y ejecutándose
2. **Node.js** (versión 16 o superior)
3. **npm** o **yarn**

## Pasos de Instalación

### 1. Crear la base de datos en PostgreSQL

```sql
-- Conectarse a PostgreSQL como administrador
createdb vitronepro
```

O si prefieres usar pgAdmin o DBeaver, simplemente crea una base de datos llamada `vitronepro`.

### 2. Configurar variables de entorno

Ya existe un archivo `.env` en la raíz del proyecto. Actualiza los valores según tu configuración de PostgreSQL:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password_aqui
DB_NAME=vitronepro
JWT_SECRET=tu_clave_secreta_aqui
NODE_ENV=development
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Ejecutar el proyecto

**Modo desarrollo (con auto-reload):**
```bash
npm run start:dev
```

**Modo producción:**
```bash
npm run build
npm run start:prod
```

## Endpoints de Autenticación

### 1. Registrar nuevo usuario
**POST** `http://localhost:3000/auth/register`

Body:
```json
{
  "email": "usuario@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "password": "password123"
}
```

Respuesta:
```json
{
  "message": "Usuario registrado exitosamente",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

### 2. Login de usuario
**POST** `http://localhost:3000/auth/login`

Body:
```json
{
  "email": "usuario@example.com",
  "password": "password123"
}
```

Respuesta:
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

### 3. Obtener perfil (Protegido con JWT)
**GET** `http://localhost:3000/auth/profile`

Headers:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Respuesta:
```json
{
  "message": "Perfil del usuario",
  "user": {
    "id": "uuid-del-usuario",
    "email": "usuario@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

## Estructura del Proyecto

```
src/
├── auth/                    # Módulo de autenticación
│   ├── auth.controller.ts   # Controlador de rutas
│   ├── auth.module.ts       # Módulo principal
│   ├── auth.service.ts      # Lógica de autenticación
│   ├── jwt.strategy.ts      # Estrategia de Passport JWT
│   └── jwt-auth.guard.ts    # Guard para proteger rutas
├── users/                   # Módulo de usuarios
│   ├── user.entity.ts       # Entidad de BD
│   ├── users.module.ts      # Módulo de usuarios
│   └── users.service.ts     # Servicio de usuarios
├── database/                # Configuración de BD
│   └── database.config.ts   # Configuración TypeORM
├── app.controller.ts        # Controlador principal
├── app.module.ts            # Módulo principal
├── app.service.ts           # Servicio principal
└── main.ts                  # Punto de entrada
```

## Cómo Funciona

1. **Registro**: Usuario se registra con email, nombre, apellido y contraseña
2. **Hash de Contraseña**: Se usa bcryptjs para hashear la contraseña (nunca se guarda en texto plano)
3. **Login**: Se valida email y contraseña, si es correcto se genera un JWT
4. **JWT**: Token válido por 24 horas que se envía en el header `Authorization: Bearer <token>`
5. **Guard**: Las rutas protegidas validan el JWT automáticamente

## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| DB_HOST | Host de PostgreSQL | localhost |
| DB_PORT | Puerto de PostgreSQL | 5432 |
| DB_USERNAME | Usuario de PostgreSQL | postgres |
| DB_PASSWORD | Contraseña de PostgreSQL | postgres |
| DB_NAME | Nombre de la base de datos | vitronepro |
| JWT_SECRET | Clave secreta para JWT | your-secret-key |
| NODE_ENV | Ambiente (development/production) | development |
| PORT | Puerto de la aplicación | 3000 |

## Próximos Pasos (Opcionales)

1. **Validación DTO**: Crear DTOs con class-validator para validar datos de entrada
2. **Refresh Tokens**: Implementar refresh tokens para renovar sesiones
3. **Roles y Permisos**: Agregar roles de usuario (admin, user, etc.)
4. **Email Verification**: Verificación de email antes de activar cuenta
5. **Password Reset**: Sistema de recuperación de contraseña
6. **Rate Limiting**: Limitar intentos de login
7. **2FA**: Autenticación de dos factores

## Solución de Problemas

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
- Asegúrate de que PostgreSQL está ejecutándose
- Verifica las credenciales en el archivo `.env`

### Error: "FATAL: database does not exist"
- Crea la base de datos `vitronepro` en PostgreSQL

### Error: "JWT not valid"
- El token JWT puede haber expirado (válido por 24 horas)
- Intenta hacer login nuevamente para obtener un nuevo token
