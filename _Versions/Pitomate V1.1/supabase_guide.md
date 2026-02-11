# Guía Rápida: Cómo obtener tus credenciales de Supabase

Para conectar tu "Pizarra" a la nube, necesitas 2 claves. Aquí te explico cómo obtenerlas gratis en 5 minutos.

## Paso 1: Crear Cuenta y Proyecto
1.  Ingresa a **[supabase.com](https://supabase.com)**.
2.  Haz clic en el botón verde **"Start your project"**.
3.  Te pedirá iniciar sesión con **GitHub** (es lo más fácil). Si no tienes, crea una cuenta ahí mismo.
4.  Una vez dentro, haz clic en **"New Project"**.
5.  Llena el formulario:
    - **Name**: `TorneoDomino`
    - **Database Password**: Escribe una contraseña segura y *guárdala* (la necesitarás si te conectas manualmente, pero no para la app por ahora).
    - **Region**: Elige una cercana a ti (ej. `East US` o `Sao Paulo`).
    - **Pricing Plan**: Asegúrate que diga **"Free" ($0)**.
6.  Clic en **"Create new project"**. Espera unos minutos a que se configure.

## Paso 2: Obtener las Credenciales (API Keys)
Una vez que el proyecto esté listo (verás un panel con gráficas verdes):

1.  En la barra lateral izquierda, busca el ícono de **Engranaje (Settings)** (abajo del todo).
2.  En el menú que se abre, selecciona **"API"**.
3.  Verás una sección llamada **"Project URL"**.
    - Copia la URL (empieza con `https://...`).
4.  Debajo verás **"Project API keys"**.
    - Busca la que dice `anon` `public`.
    - Copia esa clave larga.

## Paso 3: Pegarlas en el Proyecto
Pásame esos dos datos por aquí, o pégalos tú mismo en el archivo `.env.local` de la siguiente manera:

```bash
NEXT_PUBLIC_SUPABASE_URL=pega_tu_url_aqui
NEXT_PUBLIC_SUPABASE_ANON_KEY=pega_tu_clave_anon_aqui
```
