"use client";

import { useEffect, useState } from 'react';

/**
 * VersionChecker Component (V4.9)
 * 
 * Automatically detects when a new version is deployed and reloads the page.
 * This ensures all users always have the latest code without manual refresh.
 * 
 * How it works:
 * 1. Fetches /version.json every 30 seconds
 * 2. Compares with current version in localStorage
 * 3. If different, shows notification and reloads after 3 seconds
 */

const CURRENT_VERSION = "5.5.0";
const CHECK_INTERVAL = 30000; // 30 seconds
const RELOAD_DELAY = 3000; // 3 seconds

export default function VersionChecker() {
    const [showUpdateNotice, setShowUpdateNotice] = useState(false);

    useEffect(() => {
        // Skip in development to avoid constant reloads
        if (process.env.NODE_ENV === 'development') {
            console.log('⚙️ Auto-update disabled in development');
            return;
        }

        // Store current version on first load
        const storedVersion = localStorage.getItem('app_version');
        if (!storedVersion) {
            localStorage.setItem('app_version', CURRENT_VERSION);
        }

        const checkVersion = async () => {
            try {
                const response = await fetch('/version.json', {
                    cache: 'no-store', // Always get fresh version
                    headers: { 'Cache-Control': 'no-cache' }
                });

                if (!response.ok) return;

                const data = await response.json();
                const serverVersion = data.version;
                const clientVersion = localStorage.getItem('app_version') || CURRENT_VERSION;

                console.log(`🔍 Version check: Client=${clientVersion}, Server=${serverVersion}`);

                if (serverVersion !== clientVersion) {
                    console.log('🆕 New version detected! Reloading in 3 seconds...');
                    setShowUpdateNotice(true);

                    // Update stored version
                    localStorage.setItem('app_version', serverVersion);

                    // Reload after delay
                    setTimeout(() => {
                        window.location.reload();
                    }, RELOAD_DELAY);
                }
            } catch (error) {
                console.error('❌ Version check failed:', error);
            }
        };

        // Check immediately on mount
        checkVersion();

        // Then check every 30 seconds
        const intervalId = setInterval(checkVersion, CHECK_INTERVAL);

        return () => clearInterval(intervalId);
    }, []);

    if (!showUpdateNotice) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] animate-pulse">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <div className="w-3 h-3 bg-white rounded-full animate-ping"></div>
                <span className="font-bold text-lg">
                    🎉 Nueva versión disponible - Actualizando...
                </span>
            </div>
        </div>
    );
}
