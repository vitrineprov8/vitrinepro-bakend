# Configuración de Ambientes - JWT & URLs

## 🔐 JWT_SECRET

**¿Dónde lo consigo?**
Genera una clave segura con uno de estos comandos:

### Opción 1: Node.js (en la carpeta del proyecto)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Opción 2: PowerShell (Windows)
```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### Opción 3: OpenSSL
```bash
openssl rand -hex 32
```

Luego, copia el valor generado a:
- `.env` (desarrollo local)
- `.env.production` (producción)

---

## 🌍 Configuración de URLs

### Desarrollo Local
```
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
LINKEDIN_CALLBACK_URL=http://localhost:3000/auth/linkedin/callback
FRONTEND_URL=http://localhost:4321
```

### Producción (v8pro.com.br)
```
GOOGLE_CALLBACK_URL=https://www.v8pro.com.br/auth/google/callback
LINKEDIN_CALLBACK_URL=https://www.v8pro.com.br/auth/linkedin/callback
FRONTEND_URL=https://www.v8pro.com.br
```

---

## 🐳 Uso con Docker

### Desarrollo
```bash
docker-compose up --build
# Usa .env.development automáticamente
```

### Producción
```bash
docker-compose -f docker-compose.yml up --build
# Crea un docker-compose.prod.yml y usa .env.production
```

### En docker-compose.yml, añade:
```yaml
env_file:
  - .env.development  # para desarrollo

# O para producción:
env_file:
  - .env.production
```

---

## ⚠️ Importante

1. **Nunca guardes credenciales reales en Git**
   - Agrega a `.gitignore`: `.env`, `.env.development`, `.env.production`

2. **Credenciales de OAuth**
   - Asegúrate de registrar los Redirect URIs en Google y LinkedIn
   - Google Console: https://console.cloud.google.com
   - LinkedIn: https://www.linkedin.com/developers/apps

3. **Variables de Entorno en Producción**
   - En tu servidor/contenedor de producción, usa variables de entorno del sistema
   - No uses archivos `.env` en producción (usa Docker secrets, env vars del servidor, etc.)

---

## 📋 Archivos incluidos

- `.env` - Desarrollo local
- `.env.development` - Desarrollo con Docker
- `.env.production` - Producción
