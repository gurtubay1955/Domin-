#!/bin/bash
echo "============================================"
echo "   ANALIZANDO TU MEMORIA RAM (SLOTS)        "
echo "============================================"
echo ""
echo "Pidiendo acceso al hardware (pon tu contraseña si la pide)..."
# Usamos sudo para leer la info del hardware
sudo dmidecode -t memory | grep -E "Size:|Type:|Speed:|Locator:" | grep -v "Clock"
echo ""
echo "============================================"
echo "   COMO LEER ESTO:"
echo "   - Si ves 2 bloques de 'Size: 4096 MB', tienes 2 de 4GB (Total 8GB)."
echo "   - Si ves 'Size: No Module Installed', el slot está vacío."
echo "============================================"
echo ""
echo "Presiona Enter para cerrar."
read dummy
