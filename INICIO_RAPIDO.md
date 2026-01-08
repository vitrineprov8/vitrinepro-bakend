# 🎯 PRIMEROS PASOS - INSTRUCCIONES DE USO

## ¡Hola Andrés! 👋

Tu sistema de login está **100% completamente implementado**. Aquí está todo lo que necesitas saber para empezar:

---

## 1️⃣ REQUISITOS PREVIOS

✅ Tienes **Node.js** instalado  
✅ Tienes **Docker** instalado (o PostgreSQL local)  
✅ El proyecto ya está **compilado** sin errores  
✅ Todas las **dependencias instaladas**  

---

## 2️⃣ INICIAR EL PROYECTO (3 PASOS)

### **PASO 1: Abre una terminal PowerShell**
```powershell
cd c:\Users\andr3\Documents\projectos\project-bakend-vitronepro
```

### **PASO 2: Inicia PostgreSQL con Docker**
```powershell
.\start-postgres.bat
```

**Deberías ver algo como:**
```
Iniciando PostgreSQL con Docker...
====================================
PostgreSQL iniciado exitosamente!
====================================
Host: localhost
Puerto: 5432
Usuario: postgres
Contraseña: postgres
Base de datos: vitronepro
====================================

Para detener: docker-compose down
```

⏳ **Espera 10 segundos a que PostgreSQL esté completamente listo**

### **PASO 3: Abre OTRA terminal PowerShell e inicia el servidor**
```powershell
cd c:\Users\andr3\Documents\projectos\project-bakend-vitronepro
npm run start:dev
```

**Deberías ver algo como:**
```
[Nest] 12345  - 01/08/2026, 3:45:00 PM   LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [InstanceLoader] TypeOrmModule dependencies initialized
[Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [RoutesResolver] AuthController {...}
[Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [NestApplication] Listening on port 3000
```

✅ **¡Listo! El servidor está corriendo en http://localhost:3000**

---

## 3️⃣ PRUEBA LOS ENDPOINTS

Abre **Postman** o **Insomnia** y prueba esto:

### **A) Registrar un nuevo usuario**

**POST** `http://localhost:3000/auth/register`

**Body (JSON):**
```json
{
  "email": "test@example.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "password": "Password123!"
}
```

**Respuesta esperada:**
```json
{
  "message": "Usuario registrado exitosamente",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

### **B) Hacer login**

**POST** `http://localhost:3000/auth/login`

**Body (JSON):**
```json
{
  "email": "test@example.com",
  "password": "Password123!"
}
```

**Respuesta esperada:**
```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

**⚠️ Guarda el `access_token` para el siguiente paso**

### **C) Obtener el perfil (Protegido)**

**GET** `http://localhost:3000/auth/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

*(Reemplaza con el token que obtuviste en el login)*

**Respuesta esperada:**
```json
{
  "message": "Perfil del usuario",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "test@example.com",
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

---

## 4️⃣ USAR LA COLECCIÓN DE POSTMAN

Si quieres una forma más fácil:

1. Abre **Postman**
2. Click en **Import** → **Upload Files**
3. Selecciona: `Vitronepro_API.postman_collection.json`
4. ¡Listo! Todos los endpoints están configurados

---

## 5️⃣ ARCHIVOS IMPORTANTES

| Archivo | Descripción |
|---------|-------------|
| `.env` | Variables de entorno (BD, JWT, etc) |
| `src/auth/` | Lógica de autenticación |
| `src/users/` | Modelo de usuarios |
| `src/database/` | Configuración de BD |

---

## 6️⃣ COMANDOS ÚTILES

```powershell
# Modo desarrollo (con auto-reload)
npm run start:dev

# Compilar el proyecto
npm run build

# Modo producción
npm run start:prod

# Ejecutar tests
npm test

# Ejecutar tests E2E
npm run test:e2e

# Linting
npm run lint
```

---

## 7️⃣ PARAR EL PROYECTO

Cuando termines:

```powershell
# En la terminal de NestJS: Ctrl + C

# En la terminal de Docker: Ctrl + C
# O ejecuta:
docker-compose down
```

---

## 🆘 SI ALGO NO FUNCIONA

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
```powershell
# PostgreSQL no está corriendo, intenta nuevamente:
.\start-postgres.bat

# Y espera 10 segundos
```

### Error: "FATAL: database 'vitronepro' does not exist"
```powershell
# Docker debería crear la BD automáticamente
# Intenta eliminar y reiniciar:
docker-compose down
docker volume prune
.\start-postgres.bat
```

### Error: "Port 3000 is already in use"
```powershell
# Cambia el puerto en .env:
PORT=3001

# O mata el proceso Node:
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force
```

**Para más problemas**: Lee `TROUBLESHOOTING.md`

---

## 📚 DOCUMENTACIÓN DISPONIBLE

- **README_FINAL.md** ← Lee esto para una visión completa
- **SISTEMA_LOGIN.md** ← Guía técnica detallada
- **EJEMPLOS_USO.md** ← Ejemplos con cURL, JS, Axios, etc
- **TROUBLESHOOTING.md** ← Si hay problemas

---

## 🎓 ESTRUCTURA DEL CÓDIGO

```typescript
// Registrarse
POST /auth/register
├─ Valida email único
├─ Hashea contraseña con bcrypt
├─ Crea usuario en BD
└─ Retorna JWT token

// Login
POST /auth/login
├─ Busca usuario por email
├─ Valida contraseña
└─ Retorna JWT token

// Perfil (Protegido)
GET /auth/profile
├─ Guard valida JWT
├─ Busca usuario
└─ Retorna datos del usuario
```

---

## ⚡ TECNOLOGÍAS USADAS

- **NestJS** - Framework backend
- **PostgreSQL** - Base de datos
- **TypeORM** - ORM
- **JWT** - Autenticación
- **Bcryptjs** - Encriptación
- **Passport** - Estrategias auth
- **Docker** - Contenedores

---

## 🔐 SEGURIDAD

✅ Contraseñas nunca se guardan en texto plano (hasheadas)  
✅ JWT válidos solo 24 horas  
✅ Validación automática de tokens  
✅ Rutas protegidas con guards  
✅ No hay credenciales en el código  

---

## 📊 ESTRUCTURA DE BD

```
Table: users
├─ id (UUID)
├─ email (UNIQUE VARCHAR)
├─ firstName (VARCHAR)
├─ lastName (VARCHAR)
├─ password (VARCHAR - hasheada)
├─ isActive (BOOLEAN)
├─ createdAt (TIMESTAMP)
└─ updatedAt (TIMESTAMP)
```

---

## ✨ FUNCIONALIDADES INCLUIDAS

✅ **Registro de usuarios**  
✅ **Login seguro**  
✅ **JWT Tokens**  
✅ **Obtener perfil (protegido)**  
✅ **Hash de contraseñas**  
✅ **Validación de email**  
✅ **Manejo de errores**  
✅ **Timestamps automáticos**  
✅ **Guards reutilizables**  

---

## 🚀 PRÓXIMOS PASOS

Cuando quieras, puedo agregarte:

1. **DTOs** - Validación automática de datos
2. **Refresh Tokens** - Renovar sesiones sin login
3. **Roles** - Admin, user, moderator
4. **Email Verification** - Confirmar email
5. **Password Reset** - Recuperación de contraseña
6. **Rate Limiting** - Limitar intentos
7. **2FA** - Autenticación de dos factores
8. **Tests Completos** - Cobertura 100%

---

## 📝 CAMBIOS EN .env (SI LO NECESITAS)

Si tienes PostgreSQL local con otra contraseña:

```env
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=TU_CONTRASEÑA_AQUÍ  ← Cambia esto
DB_NAME=vitronepro

# JWT (Cambia en producción)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Aplicación
NODE_ENV=development
PORT=3000
```

---

## ✅ CHECKLIST FINAL

Antes de empezar, verifica:

- [ ] Terminal 1: PostgreSQL está corriendo (`.\start-postgres.bat`)
- [ ] Terminal 2: Servidor está corriendo (`npm run start:dev`)
- [ ] Puedes acceder a `http://localhost:3000` en Postman
- [ ] El endpoint `/auth/register` funciona
- [ ] El endpoint `/auth/login` funciona
- [ ] El endpoint `/auth/profile` funciona con token

---

## 🎉 ¡FELICIDADES!

**Tu sistema de login está completamente listo para usar.**

Solo necesitas:
1. Ejecutar `.\start-postgres.bat`
2. Ejecutar `npm run start:dev`
3. ¡Empezar a usar!

¿Necesitas ayuda con algo? Lee la documentación o preguntame cualquier cosa.

---

**Created**: 8 de Enero de 2026  
**Project**: Backend NestJS - Vitronepro  
**Status**: ✅ Completado y Funcionando
