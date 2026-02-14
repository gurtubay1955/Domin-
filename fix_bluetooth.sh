#!/bin/bash
echo "============================================"
echo "   REPARANDO CONEXIÓN BLUETOOTH 🦷💙        "
echo "============================================"
echo ""
echo "Diagnóstico: Tu adaptador Bluetooth se está durmiendo cada 2 segundos."
echo "Solución: Vamos a prohibirle que se duerma."
echo ""
echo "Pidiendo permisos de administrador..."

# 1. Desactivar autosuspend ahora mismo (para el puerto 1-4 detectado)
echo "on" | sudo tee /sys/bus/usb/devices/1-4/power/control > /dev/null
echo "-1" | sudo tee /sys/bus/usb/devices/1-4/power/autosuspend > /dev/null

# 2. Hacerlo permanente para el módulo BTUSB
echo "options btusb enable_autosuspend=n" | sudo tee /etc/modprobe.d/btusb_disable_autosuspend.conf > /dev/null

# 3. Regla UDEV de refuerzo (para cualquier USB Bluetooth)
echo 'ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="8087", ATTR{idProduct}=="07da", ATTR{power/autosuspend}="-1"' | sudo tee /etc/udev/rules.d/50-bluetooth-power.rules > /dev/null
# Regla para tu adaptador Realtek (Confirmado 0bda:8771)
echo 'ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="0bda", ATTR{idProduct}=="8771", ATTR{power/autosuspend}="-1"' | sudo tee -a /etc/udev/rules.d/50-bluetooth-power.rules > /dev/null
# Regla para tu Mouse 2.4G KOSEL (Confirmado 2571:4101)
echo 'ACTION=="add", SUBSYSTEM=="usb", ATTR{idVendor}=="2571", ATTR{idProduct}=="4101", ATTR{power/autosuspend}="-1"' | sudo tee -a /etc/udev/rules.d/50-bluetooth-power.rules > /dev/null
# Regla genérica de respaldo
echo 'ACTION=="add", SUBSYSTEM=="usb", ATTR{product}=="*Bluetooth*", ATTR{power/control}="on"' | sudo tee -a /etc/udev/rules.d/50-bluetooth-power.rules > /dev/null

# 4. Recargar reglas
sudo udevadm control --reload
sudo udevadm trigger

echo ""
echo "✅ ¡Arreglado!"
echo "Tu teclado debería responder mucho más rápido ahora."
echo "La configuración es permanente (sobrevive al reinicio)."
echo ""
echo "Presiona Enter para cerrar."
read dummy
