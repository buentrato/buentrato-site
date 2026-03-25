# Guía para subir BuenTrato.AI a Netlify

## Lo que tienes en esta carpeta

```
buentrato-portal/
├── index.html                          ← Portal principal
├── disc.html                           ← App de feedback DISC
├── netlify.toml                        ← Configuración de Netlify
└── netlify/functions/
    ├── generate-feedback.js            ← Función que conecta con Claude API
    └── get-team.js                     ← Función que lee equipos de Airtable
```

---

## Paso 0: Liberar el nombre "buentrato" en Netlify

Tu sitio actual `buentrato.netlify.app` tiene las calculadoras de Tualotuyo SAS. Para liberar ese nombre:

1. Ve a **app.netlify.com** y entra al sitio `buentrato`
2. Ve a **"Site configuration"** → **"Change site name"**
3. Cámbialo a otro nombre (ej: `tualotuyo`) → quedará en `tualotuyo.netlify.app`
4. Tus calculadoras siguen funcionando igual, solo cambia la dirección

---

## Paso 1: Subir BuenTrato.AI a Netlify

1. En **app.netlify.com**, busca el botón **"Add new site"** → **"Deploy manually"**
2. **Arrastra toda la carpeta `buentrato-portal`** al área que dice "drag and drop"
3. Espera unos segundos — Netlify te dará una URL temporal
4. Ve a **"Site configuration"** → **"Change site name"** y ponle **`buentrato`**
   - Tu URL quedaría: `buentrato.netlify.app`

---

## Paso 2: Configurar la API de Claude

Para que el feedback con IA funcione, necesitas agregar tu API key:

1. En tu sitio de Netlify, ve a **"Site configuration"** → **"Environment variables"**
2. Haz clic en **"Add a variable"**
3. Escribe:
   - **Key:** `CLAUDE_API_KEY`
   - **Value:** tu API key de Anthropic (la que empieza con `sk-ant-...`)
4. Guarda

**Nota:** Sin este paso, la app funciona igual pero solo muestra los consejos predefinidos (sin el análisis personalizado de IA).

---

## Paso 3: Probar

1. Abre tu URL (ej: `buentrato.netlify.app`)
2. Deberías ver el portal con las herramientas
3. Haz clic en "Feedback de Relacionamiento DISC"
4. Ingresa el código: **DEMO2026**
5. Prueba seleccionando personas y temas

---

## Paso 4: Configurar Airtable

Para que la app lea los equipos reales desde tu Airtable:

1. En Netlify, ve a **"Project configuration"** → **"Environment variables"**
2. Agrega DOS variables nuevas:
   - **Key:** `AIRTABLE_API_KEY` → **Value:** tu Personal Access Token de Airtable
   - **Key:** `AIRTABLE_BASE_ID` → **Value:** el ID de tu base (empieza con `app...`)
3. Vuelve a hacer deploy (arrastra la carpeta de nuevo en Deploys)

Los códigos de equipo se generan automáticamente a partir de Empresa + Equipo.
Al ingresar un código incorrecto, la consola del navegador (F12) muestra todos los códigos disponibles.

---

## Próximos pasos (los hacemos juntos)

- [ ] Personalizar colores y logo de BuenTrato.AI
- [ ] Agregar dominio personalizado (ej: app.buentrato.ai)

---

## ¿Algo no funciona?

Tráeme el error o cuéntame qué pasó y lo resolvemos juntos en nuestra próxima conversación.
