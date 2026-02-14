#!/bin/bash
echo "============================================"
echo "   ACTIVANDO MODO TURBO (PERFORMANCE)       "
echo "============================================"
echo ""
echo "Este script forzará a tu CPU i7 a trabajar al máximo (3.3GHz)."
echo "Nota: Tu Mac se calentará un poco más."
echo ""
echo "Pidiendo permisos de administrador..."

# Iterar sobre todos los núcleos y ponerlos en performance
for cpu in /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
do
    echo "performance" | sudo tee $cpu > /dev/null
done

echo ""
echo "✅ ¡Modo Turbo Activado!"
echo "Frecuencia actual:"
cat /proc/cpuinfo | grep "MHz" | head -n 1
echo ""
echo "Presiona Enter para cerrar."
read dummy
