# BuenTrato.AI — Portal DISC

## Resumen
Portal web interactivo para BuenTrato.AI con herramientas de evaluación DISC desplegado en Netlify. Incluye informe individual personalizado con IA y feedback de relacionamiento entre compañeros de equipo.

## URLs en producción
- **Portal principal**: https://disc.buentrato.ai
- **Informe DISC Individual**: https://disc.buentrato.ai/informe?code={evaluacion_uid}
- **Feedback de Relacionamiento**: https://disc.buentrato.ai/disc
- **Código de prueba**: EVAL_2025_12_10_ana_cancimanse

## Arquitectura

### Frontend (HTML estático en Netlify)
- `index.html` — Portal principal con 3 herramientas (Individual, Relacionamiento, Mapa Equipo)
- `informe.html` — Informe DISC individual. Pide código personal, consulta Airtable, genera texto con Claude AI
- `disc.html` — Feedback de relacionamiento. Equipos hardcodeados, genera feedback con Claude AI
- `logo.png` — Logo completo BuenTrato.AI (carita + texto)
- `carita.png` — Solo la carita :) del logo, para iconos
- `netlify.toml` — Configuración de build y redirects (/disc → disc.html, /informe → informe.html)

### Backend (Netlify Serverless Functions - Node.js)
- `netlify/functions/get-report.js` — Busca evaluación en Airtable (base BuenTrato) por evaluacion_uid, obtiene persona vinculada, luego busca porcentajes DISC en base PRUEBAS por email
- `netlify/functions/generate-report.js` — Genera texto personalizado del informe con Claude AI (Haiku). Acepta parámetro `group`: "estilo", "interpersonal", "contexto". Se hacen 3 llamadas paralelas desde el frontend para evitar timeout de 30s
- `netlify/functions/generate-feedback.js` — Genera feedback de relacionamiento con Claude AI
- `netlify/functions/get-team.js` — Consulta equipos desde Airtable

### Flujo del Informe Individual
1. Usuario ingresa código personal (evaluacion_uid)
2. Frontend llama a `get-report.js` → busca en Airtable EVALUACIONES → obtiene email de PERSONAS → busca porcentajes en PRUEBAS/Respuestas Equipo
3. Frontend renderiza gráficos donut (Canvas) y barras comparativas Natural vs Adaptado
4. Frontend hace 3 llamadas paralelas a `generate-report.js` con grupos: estilo, interpersonal, contexto
5. Cada grupo genera 2-3 secciones de texto con Claude Haiku en <15 segundos

## Airtable

### Base BuenTrato (app2psDmvIE74vhkQ)
- **EVALUACIONES** (tblsYWKZWqKpg2Emd): evaluacion_uid, persona (link), resultados_json, snapshot_empresa/cargo/area/proyecto, fecha_realizacion
- **PERSONAS** (tblw5g879AP13AiOw): nombre_completo, email, nombre, apellido
- **PROYECTOS** (tblFxoa4KL71xZgDv)
- **EMPRESAS** (tblrxyUed67FrozPf)

### Base PRUEBAS (appaTeQAba3xYfycx)
- **Respuestas Equipo** (tbl6O1XFe2U1ylxud): Porcentajes DISC ya calculados. Campos clave:
  - porcentaje_D_Natural, porcentaje_I_Natural, porcentaje_S_Natural, porcentaje_C_Natutal (typo)
  - porcentaje_D_Adaptado, porcentaje_I_Adaptado, porcentaje_S_Adaptado, Porcentaje_C_Adapatdo (typo, P mayúscula)
  - Puntaje_D_Natural, etc. (raw scores)
  - Email (usado como enlace entre bases)
  - Los porcentajes se almacenan como decimales (0.36 = 36%)

## Infraestructura

### Netlify
- **Plan**: Pro (~$20/mes)
- **Repo GitHub**: buentrato/buentrato-site
- **Auto-deploy**: Push a GitHub → deploy automático
- **Timeout funciones**: 30 segundos (Pro)
- **Variables de entorno**:
  - `AIRTABLE_API_KEY` — Personal Access Token (pat...) con scope data.records:read, acceso a bases BuenTrato y PRUEBAS
  - `CLAUDE_API_KEY` — API key de Anthropic (sk-ant-api03-...)
  - `NODE_VERSION` — 18

### DNS
- disc.buentrato.ai → Netlify (CNAME)
- buentrato.ai → Canva (A records)

### Claude API
- Modelo: claude-haiku-4-5-20251001
- max_tokens: 1500 por grupo
- Balance Anthropic: ~$4.71 (verificar)

## Identidad visual
- **Primary**: #0380A6
- **Primary dark**: #026B8A
- **Primary deeper**: #01516A
- **Accent**: #04B5D6
- **Colores DISC**:
  - D (Dominancia): #01516A / light: #E2EEF3
  - I (Influencia): #0380A6 / light: #E6F4F9
  - S (Serenidad): #04B5D6 / light: #E0F5FA
  - C (Cumplimiento): #6DCFE0 / light: #EBF8FB
- **Font**: Inter (Google Fonts)
- **Iconos**: carita.png (solo :) del logo) en vez de emojis

## Pendientes
- Mapa de Equipo DISC (tercera herramienta, actualmente "Próximamente")
- Integrar líderes desde tabla "Respuestas Liderazgo" en Airtable
- Migrar equipos hardcodeados en disc.html a consulta dinámica de Airtable

## Notas técnicas
- Los porcentajes DISC en informe individual se leen de la base PRUEBAS (ya calculados), NO se calculan dividiendo entre la suma
- generate-report.js usa 3 grupos paralelos para evitar el timeout de 30s de Netlify
- disc.html tiene los equipos hardcodeados en DEMO_TEAMS y AIRTABLE_TEAMS dentro del HTML
- El enlace entre bases BuenTrato y PRUEBAS es por email de la persona
