#!/bin/bash
echo "🚀 Iniciando preparación para Vercel..."

# 1. Init Git if not exists
if [ ! -d ".git" ]; then
    echo "📦 Inicializando Git..."
    git init
    git branch -M main
else
    echo "✅ Git ya estaba inicializado."
fi

# 2. Add files
echo "➕ Agregando archivos..."
git add .

# 3. Commit
echo "💾 Creando commit inicial..."
git commit -m "Deploy V1: Pitomate App Ready for Vercel"

echo ""
echo "🎉 ¡Todo listo localmente!"
echo "---------------------------------------------------"
echo "PASOS SIGUIENTES (Manuales):"
echo "1. Crea un repo VACÍO en GitHub: https://github.new"
echo "2. Copia el comando que dice '...or push an existing repository from the command line'"
echo "   (Se ve así: git remote add origin ... && git push ...)"
echo "3. Pégalo aquí en la terminal y dale Enter."
echo "4. Ve a Vercel -> Add New Project -> Import from GitHub."
echo "---------------------------------------------------"
