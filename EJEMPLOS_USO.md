# Ejemplos de Uso - Sistema de Login

## Usando cURL

### 1. Registrar un nuevo usuario

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "password": "Password123!"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "Password123!"
  }'
```

Esto retornará un token. Guarda el token para usarlo en las siguientes peticiones.

### 3. Obtener el perfil (Protegido)

```bash
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

Reemplaza `YOUR_JWT_TOKEN_HERE` con el token que recibiste del login.

---

## Usando Postman

### 1. Registrar usuario

1. Abre **Postman**
2. Crea una nueva solicitud **POST**
3. URL: `http://localhost:3000/auth/register`
4. Tab **Body** → Selecciona **raw** → **JSON**
5. Pega el siguiente JSON:

```json
{
  "email": "maria@example.com",
  "firstName": "María",
  "lastName": "González",
  "password": "SecurePass123!"
}
```

6. Click en **Send**
7. Verás el token en la respuesta

### 2. Login

1. Nueva solicitud **POST**
2. URL: `http://localhost:3000/auth/login`
3. Body (JSON):

```json
{
  "email": "maria@example.com",
  "password": "SecurePass123!"
}
```

4. Click en **Send**
5. Copia el `access_token` de la respuesta

### 3. Obtener Perfil (Protegido)

1. Nueva solicitud **GET**
2. URL: `http://localhost:3000/auth/profile`
3. Tab **Headers**
4. Agrega una nueva cabecera:
   - **Key**: `Authorization`
   - **Value**: `Bearer PEGA_TU_TOKEN_AQUI`
5. Click en **Send**

---

## Usando JavaScript/Fetch

### Registrarse

```javascript
async function register() {
  const response = await fetch('http://localhost:3000/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'usuario@example.com',
      firstName: 'Carlos',
      lastName: 'López',
      password: 'MyPassword123!',
    }),
  });
  const data = await response.json();
  console.log(data);
  return data.access_token;
}
```

### Login

```javascript
async function login() {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'usuario@example.com',
      password: 'MyPassword123!',
    }),
  });
  const data = await response.json();
  localStorage.setItem('token', data.access_token);
  console.log(data);
  return data.access_token;
}
```

### Obtener Perfil (Protegido)

```javascript
async function getProfile(token) {
  const response = await fetch('http://localhost:3000/auth/profile', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  const data = await response.json();
  console.log(data);
  return data;
}

// Uso:
const token = await login();
const profile = await getProfile(token);
```

### Usando Axios

```javascript
import axios from 'axios';

const API_URL = 'http://localhost:3000/auth';

// Registrar
async function register(email, firstName, lastName, password) {
  const { data } = await axios.post(`${API_URL}/register`, {
    email,
    firstName,
    lastName,
    password,
  });
  return data;
}

// Login
async function login(email, password) {
  const { data } = await axios.post(`${API_URL}/login`, {
    email,
    password,
  });
  localStorage.setItem('token', data.access_token);
  return data;
}

// Obtener Perfil
async function getProfile() {
  const token = localStorage.getItem('token');
  const { data } = await axios.get(`${API_URL}/profile`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return data;
}
```

---

## Respuestas Esperadas

### Registro Exitoso (201 Created)

```json
{
  "message": "Usuario registrado exitosamente",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MGI4N2M2MC1mOTk5LTQzMGUtYjJmOS0wOWI2NTM3ZjFjMGYiLCJlbWFpbCI6Impkb2VAZXhhbXBsZS5jb20iLCJpYXQiOjE2NzM2MTk5MjcsImV4cCI6MTY3MzcwNjMyN30.x...",
  "user": {
    "id": "70b87c60-f999-430e-b2f9-09b6537f1c0f",
    "email": "jdoe@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Login Exitoso (200 OK)

```json
{
  "message": "Login exitoso",
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3MGI4N2M2MC1mOTk5LTQzMGUtYjJmOS0wOWI2NTM3ZjFjMGYiLCJlbWFpbCI6Impkb2VAZXhhbXBsZS5jb20iLCJpYXQiOjE2NzM2MTk5NjAsImV4cCI6MTY3MzcwNjM2MH0.x...",
  "user": {
    "id": "70b87c60-f999-430e-b2f9-09b6537f1c0f",
    "email": "jdoe@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Perfil Exitoso (200 OK)

```json
{
  "message": "Perfil del usuario",
  "user": {
    "id": "70b87c60-f999-430e-b2f9-09b6537f1c0f",
    "email": "jdoe@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

### Error - Email ya registrado (400 Bad Request)

```json
{
  "message": "El email ya está registrado",
  "error": "Bad Request",
  "statusCode": 400
}
```

### Error - Credenciales incorrectas (401 Unauthorized)

```json
{
  "message": "Email o contraseña incorrectos",
  "error": "Unauthorized",
  "statusCode": 401
}
```

### Error - Token inválido (401 Unauthorized)

```json
{
  "message": "Unauthorized",
  "statusCode": 401
}
```

---

## Notas Importantes

1. **Token JWT**: Válido por 24 horas desde su creación
2. **Contraseñas**: Siempre se envían en POST, nunca en GET
3. **HTTPS**: En producción, siempre usa HTTPS (no HTTP)
4. **Token almacenamiento**: En el navegador usa localStorage, sessionStorage o cookies
5. **CORS**: Si tu frontend está en otro dominio, configura CORS en NestJS
