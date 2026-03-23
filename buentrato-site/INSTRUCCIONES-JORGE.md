# Instrucciones de Despliegue: BuenTrato.AI en Netlify

## Resumen
Este es el sitio web completo de BuenTrato.AI con landing page, herramienta DISC y funciones serverless. Se desplegará en Netlify conectado a GitHub con el dominio buentrato.ai.

---

## Paso 1: Crear Repositorio en GitHub

1. Ve a https://github.com/new
2. Crea un nuevo repositorio con el nombre: **buentrato-site**
3. Selecciona "Private" (privado) para mayor seguridad
4. No inicialices con README ni .gitignore
5. Haz clic en "Create repository"

---

## Paso 2: Subir Archivos al Repositorio

En tu terminal local:

```bash
# Navega a la carpeta del proyecto
cd /ruta/a/buentrato-site

# Inicializa git
git init

# Añade el repositorio remoto (reemplaza TU_USUARIO)
git remote add origin https://github.com/TU_USUARIO/buentrato-site.git

# Añade todos los archivos
git add .

# Realiza el primer commit
git commit -m "Initial commit: BuenTrato.AI website with landing page and DISC feedback tool"

# Sube a GitHub
git branch -M main
git push -u origin main
```

### Archivos que se subirán:
- `index.html` - Landing page profesional
- `disc.html` - Herramienta de feedback DISC
- `logo.png` - Logo de BuenTrato.AI
- `netlify.toml` - Configuración de Netlify
- `netlify/functions/get-team.js` - Función para obtener datos de equipos desde Airtable
- `netlify/functions/generate-feedback.js` - Función para generar feedback con Claude API

---

## Paso 3: Conectar con Netlify

1. Ve a https://app.netlify.com
2. Haz clic en "Import an existing project"
3. Selecciona "GitHub"
4. Autoriza Netlify en tu cuenta de GitHub
5. Busca y selecciona el repositorio **buentrato-site**
6. Haz clic en "Deploy site"

### Configuración de Build (Netlify debería detectarlo automáticamente):
- **Build command**: (dejar vacío)
- **Publish directory**: `.` (el directorio raíz)

Netlify comenzará a desplegar automáticamente.

---

## Paso 4: Configurar Variables de Entorno

Una vez desplegado en Netlify:

1. Ve a tu sitio en Netlify
2. Navega a: **Site settings** → **Build & deploy** → **Environment**
3. Haz clic en "Edit variables"
4. Añade las siguientes variables:

| Variable | Valor |
|----------|-------|
| `AIRTABLE_API_KEY` | Tu API Key de Airtable (obtén en https://airtable.com/account/tokens) |
| `ANTHROPIC_API_KEY` | Tu API Key de Anthropic (obtén en https://console.anthropic.com/api/keys) |

5. Haz clic en "Save"
6. En Netlify, ve a **Deployments** y redeploy el sitio para que use las nuevas variables:
   - Haz clic en el deployment más reciente
   - Selecciona "Redeploy without cache"

---

## Paso 5: Configurar Dominio Personalizado

1. En tu sitio de Netlify, ve a **Site settings** → **Domain management**
2. Haz clic en "Add custom domain"
3. Escribe: `buentrato.ai`
4. Netlify te mostrará instrucciones DNS

### Configurar DNS en tu proveedor de dominios (GoDaddy, Namecheap, etc.):

1. Accede a tu panel de control de dominios
2. Busca "DNS" o "Name Servers"
3. Añade un registro **CNAME** con:
   - **Host**: `buentrato` (o el subdominio)
   - **Value**: Tu URL de Netlify (ej: `buentrato-site.netlify.app`)
   - **TTL**: 3600 (o predeterminado)

4. Si prefieres usar Name Servers de Netlify:
   - Reemplaza los Name Servers de tu dominio con los que proporciona Netlify
   - Esto puede tomar 24-48 horas en propagarse

---

## Paso 6: Verificar el Despliegue

1. Espera a que el dominio se propague (puede tardar 24-48 horas)
2. Visita https://buentrato.ai
3. Verifica que:
   - La landing page carga correctamente
   - El logo aparece
   - Los botones "Solicitar Demo" dirigen a Fillout
   - El link "Feedback DISC" funciona → `/disc`

### Prueba las funciones serverless:

```bash
# Prueba get-team (con un código de equipo válido)
curl "https://buentrato.ai/.netlify/functions/get-team?code=DEMO2026"

# Prueba generate-feedback con POST
curl -X POST "https://buentrato.ai/.netlify/functions/generate-feedback" \
  -H "Content-Type: application/json" \
  -d '{
    "person1": {"name": "Ana García", "role": "Directora", "disc": {"D": 85, "I": 45, "S": 30, "C": 60}, "primaryStyle": "D"},
    "person2": {"name": "Carlos Méndez", "role": "Diseñador", "disc": {"D": 30, "I": 80, "S": 55, "C": 40}, "primaryStyle": "I"},
    "topic": "Comunicación",
    "teamName": "Equipo Demo"
  }'
```

---

## Paso 7: Monitoreo y Mantenimiento

### En Netlify:
- **Logs de funciones**: Site → **Functions** para ver errores
- **Logs de despliegue**: **Deployments** para ver el historial
- **Analytics**: Monitorea visitas y rendimiento
- **Environment**: Recuerda actualizar API keys cuando expiren

### Próximos pasos:
1. Conectar a Fillout (ya está en los botones CTA)
2. Vincular con Airtable para datos en tiempo real
3. Implementar analytics (Google Analytics, etc.)
4. Crear página de blog si es necesario

---

## Solución de Problemas

### Las funciones serverless devuelven 404
- Verifica que `netlify.toml` está en la raíz
- Asegúrate de que `AIRTABLE_API_KEY` y `ANTHROPIC_API_KEY` están configuradas
- Revisa los logs: **Site → Functions**

### El dominio no resuelve
- Espera 24-48 horas para propagación DNS
- Verifica que el CNAME está configurado correctamente
- En Netlify, confirma que el dominio está verificado (debe tener un checkmark verde)

### Errores de Airtable
- Verifica que la API Key es válida y está en el formato correcto
- Comprueba que tienes acceso a la base `appaTeQAba3xYfycx`
- Confirma que los nombres de campos en Airtable coinciden exactamente

### Errores de Claude API
- Verifica que tienes créditos disponibles en Anthropic
- Asegúrate de que la API Key no está expirada
- Revisa los logs para ver el mensaje de error exacto

---

## Contacto
Para preguntas o soporte:
- Jorge: jorge@buentrato.ai
- Juliana: juliana@buentrato.ai
- Oriana: oriana@buentrato.ai
