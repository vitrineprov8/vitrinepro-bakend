# 🆘 Troubleshooting - Guía de Problemas y Soluciones

## 1️⃣ Error: "Cannot find module '@nestjs/typeorm'"

### ¿Por qué ocurre?
Las dependencias no se instalaron correctamente o falta ejecutar `npm install`.

### ✅ Solución:
```powershell
npm install
npm install @nestjs/typeorm typeorm pg bcryptjs passport passport-jwt @nestjs/jwt @nestjs/passport dotenv
```

---

## 2️⃣ Error: "connect ECONNREFUSED 127.0.0.1:5432"

### ¿Por qué ocurre?
PostgreSQL no está ejecutándose o no se puede conectar.

### ✅ Solución Rápida (Con Docker):
```powershell
# Si tienes Docker instalado:
.\start-postgres.bat

# Espera 10 segundos
```

### ✅ Solución Manual (Sin Docker):

**Opción A - Instalar PostgreSQL:**
1. Descarga desde: https://www.postgresql.org/download/windows/
2. Instala con contraseña `postgres`
3. Asegúrate de que esté en PORT 5432
4. En el instalador marca "PostgreSQL Server" como servicio

**Opción B - Verificar que PostgreSQL está corriendo:**
- En Windows: Services.msc → Busca "PostgreSQL" → Debe estar "Running"
- O usa pgAdmin y verifica la conexión

---

## 3️⃣ Error: "FATAL: database 'vitronepro' does not exist"

### ¿Por qué ocurre?
La base de datos no fue creada.

### ✅ Solución:

**Con pgAdmin (Interfaz Visual):**
1. Abre pgAdmin (viene con PostgreSQL)
2. Click derecho en "Databases" → "Create" → "Database"
3. Nombre: `vitronepro`
4. Click "Save"

**Con Command Line (Terminal):**
```powershell
# En Windows:
psql -U postgres

# En la terminal psql:
CREATE DATABASE vitronepro;
\q
```

**Con Docker:**
```powershell
# Automáticamente crea la BD vitronepro
.\start-postgres.bat
```

---

## 4️⃣ Error: "password authentication failed for user 'postgres'"

### ¿Por qué ocurre?
La contraseña en `.env` es incorrecta.

### ✅ Solución:
1. Abre `.env`
2. Cambia `DB_PASSWORD` a la contraseña que usaste al instalar PostgreSQL
3. Por defecto es `postgres`

```env
# Opción 1 - Default:
DB_PASSWORD=postgres

# Opción 2 - Tu contraseña:
DB_PASSWORD=tu_password_aqui
```

---

## 5️⃣ Error: "Port 5432 is already in use"

### ¿Por qué ocurre?
Otro proceso está usando el puerto.

### ✅ Solución:
```powershell
# Encuentra qué proceso usa el puerto:
Get-NetTCPConnection -LocalPort 5432

# O simplemente detén todos los contenedores Docker:
docker-compose down

# Espera 5 segundos e intenta nuevamente:
.\start-postgres.bat
```

---

## 6️⃣ Error: "Port 3000 is already in use"

### ¿Por qué ocurre?
Otro servicio usa el puerto 3000.

### ✅ Solución:
```powershell
# Opción 1: Cambiar el puerto en .env
PORT=3001  # Usa otro puerto

# Opción 2: Matar el proceso que usa puerto 3000
Get-Process | Where-Object {$_.ProcessName -eq "node"} | Stop-Process -Force

# Opción 3: Usar otro puerto directamente:
npm run start:dev -- --port 3001
```

---

## 7️⃣ Error: "Unexpected end of JSON input" al compilar

### ¿Por qué ocurre?
Problema en algún archivo JSON (package.json, tsconfig.json, etc.)

### ✅ Solución:
```powershell
# Limpia todo y reinstala:
rm -r node_modules
rm package-lock.json
npm install
npm run build
```

---

## 8️⃣ Error: "JWT secret is not defined"

### ¿Por qué ocurre?
El archivo `.env` no se está cargando o falta JWT_SECRET.

### ✅ Solución:
1. Verifica que existe `.env` en la raíz del proyecto
2. Asegúrate de tener:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

3. Si aún no funciona:
```powershell
# Reinstala dotenv:
npm install dotenv

# Y verifica que main.ts tenga:
import 'dotenv/config';
```

---

## 9️⃣ Error: "Unauthorized" al acceder a /auth/profile

### ¿Por qué ocurre?
- No enviaste el token
- El token expiró
- El token es inválido

### ✅ Solución:

**Verifica que estés enviando el token:**
```
GET /auth/profile
Headers:
  Authorization: Bearer YOUR_TOKEN_HERE
```

**El token expiró (24 horas):**
```
POST /auth/login  # Obtén un nuevo token
```

**Verifica que el token sea válido:**
- Copia el token del login
- Pégalo exactamente en Postman
- Sin cambios ni espacios adicionales

---

## 🔟 Error: "TypeScript compilation error"

### ¿Por qué ocurre?
Hay un error de tipado en TypeScript.

### ✅ Solución:
```powershell
# Ver el error específico:
npm run build

# Solucionar errores típicos:
# 1. Asegúrate de que todos los tipos están correctos
# 2. Verifica que importas lo que usas
# 3. Verifica que las funciones retornan el tipo correcto

# Si todo falla, reinstala dependencias:
npm install
npm run build
```

---

## 1️⃣1️⃣ Docker no funciona

### ¿Por qué ocurre?
Docker no está instalado o no inicia.

### ✅ Solución:

**Si Docker no está instalado:**
1. Descarga: https://www.docker.com/products/docker-desktop
2. Instala Docker Desktop
3. Reinicia la computadora
4. Abre PowerShell y verifica:
```powershell
docker --version
docker-compose --version
```

**Si Docker está instalado pero no funciona:**
```powershell
# Reinicia Docker:
docker-compose down
docker-compose up -d

# O simplemente usa PostgreSQL local en vez de Docker
```

---

## 1️⃣2️⃣ NPM no funciona correctamente

### ¿Por qué ocurre?
Node.js/npm no está instalado o tiene problemas.

### ✅ Solución:
```powershell
# Verifica que Node.js está instalado:
node --version  # Debe ser v16+
npm --version

# Si no está:
# Descarga desde: https://nodejs.org/ (LTS)

# Limpia caché de npm:
npm cache clean --force

# Reinstala dependencias:
rm -r node_modules
rm package-lock.json
npm install
```

---

## 1️⃣3️⃣ Los endpoints no responden

### ¿Por qué ocurre?
El servidor no está ejecutándose correctamente.

### ✅ Solución:
```powershell
# Verifica que el servidor está corriendo:
npm run start:dev

# Deberías ver algo como:
# [Nest] 12345  - 01/08/2026, 3:45:00 PM   LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [InstanceLoader] TypeOrmModule dependencies initialized +...
# [Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [RoutesResolver] AuthController {...}
# [Nest] 12345  - 01/08/2026, 3:45:01 PM   LOG [NestApplication] Listening on port 3000 +50ms

# Si ves errores, copia y pega aquí para ayuda
```

---

## 📋 Checklist de Verificación

Antes de reportar un problema, verifica esto:

- [ ] PostgreSQL está ejecutándose
- [ ] El archivo `.env` existe y tiene valores correctos
- [ ] Ejecutaste `npm install`
- [ ] La base de datos `vitronepro` existe
- [ ] Node.js versión es 16+ (`node --version`)
- [ ] Puerto 3000 está disponible
- [ ] Puerto 5432 (PostgreSQL) está disponible
- [ ] No hay errores de compilación (`npm run build`)

---

## 🚀 Verificación de que todo funciona

Ejecuta estos comandos en orden:

```powershell
# 1. Verifica Node.js
node --version

# 2. Verifica que las dependencias están instaladas
npm install

# 3. Compila el proyecto
npm run build

# 4. Inicia PostgreSQL
.\start-postgres.bat

# 5. En otra terminal, inicia el servidor
npm run start:dev

# 6. En una tercera terminal, prueba un endpoint
curl -X POST http://localhost:3000/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"test123"}'
```

---

## 📞 Si nada funciona

Proporciona la siguiente información:

1. **Sistema operativo**: Windows 10/11
2. **Versión de Node.js**: `node --version`
3. **Error exacto**: Copia y pega el mensaje de error
4. **Pasos que ejecutaste**: ¿Qué comandos corriste?
5. **Archivo `.env` actualizado**: ¿Las credenciales son correctas?
6. **Log de compilación**: Resultado de `npm run build`

---

**¡Todo debe funcionar! Si hay problemas, probablemente es un pequeño detalle que podemos arreglar fácilmente.**
