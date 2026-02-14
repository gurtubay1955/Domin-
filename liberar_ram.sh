#!/bin/bash
# Script para liberar memoria RAM de forma segura
# Antigravity RAM Cleaner

echo "============================================"
echo "   LIMPIEZA DE MEMORIA RAM EN PROCESO...    "
echo "============================================"
echo ""
echo "Paso 1: Sincronizando datos al disco (sync)..."
sync
echo "Hecho."
echo ""
echo "Paso 2: Liberando caché del sistema..."
# Intentamos usar pkexec para pedir contraseña gráfica si es necesario
if command -v pkexec >/dev/null 2>&1; then
    pkexec sh -c 'echo 3 > /proc/sys/vm/drop_caches'
else
    # Fallback a sudo normal
    echo "Por favor, introduce tu contraseña de administrador:"
    sudo sh -c 'echo 3 > /proc/sys/vm/drop_caches'
fi
echo "Hecho."
echo ""
echo "============================================"
echo "   ¡MEMORIA LIBERADA CON ÉXITO! 🚀          "
echo "============================================"
echo ""
echo "Estado actual de la memoria:"
free -h
echo ""
echo "Presiona Enter para cerrar esta ventana."
read dummy
