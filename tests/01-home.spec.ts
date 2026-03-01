import { test, expect } from '@playwright/test';

test.describe('Flujo Inicial - Menú Principal V9 Titanium', () => {
    test('La pantalla de inicio carga correctamente y muestra las opciones dinámicas V9', async ({ page }) => {
        // Navigate with NetworkIdle to wait for Next.js App Router hydration
        await page.goto('/', { waitUntil: 'networkidle' });

        // Validate the main Header
        await expect(page.getByRole('heading', { name: /Pitomate/i })).toBeVisible({ timeout: 15000 });

        // Validate Host Dropdown Button
        const hostDropdown = page.locator('button', { hasText: 'Anfitrión:' });
        await expect(hostDropdown).toBeVisible();

        // Validate Player Link
        const playerLink = page.locator('a', { hasText: 'SOY JUGADOR' });
        await expect(playerLink).toBeVisible();

        // Validate Host Action Button (Initially "Elige Anfitrión Primero")
        const hostActionButton = page.locator('button', { hasText: 'ELIGE ANFITR' });
        await expect(hostActionButton).toBeVisible();

        // Validate Analytics Link (Trophy Title)
        const analyticsLink = page.locator('a[href="/analytics"]').first();
        await expect(analyticsLink).toBeVisible();
    });

    test('La navegación hacia "Analytics" (Resultados) funciona correctamente', async ({ page }) => {
        await page.goto('/', { waitUntil: 'networkidle' });

        // Click on the Trophy Link
        await page.getByRole('link', { name: /Domino Analytics Avanzado/i }).click();

        // Verify URL change to Analytics
        await expect(page).toHaveURL(/.*\/analytics/, { timeout: 15000 });

        // Verify some text on the Analytics dashboard
        await expect(page.getByText(/Standings Oficiales/i)).toBeVisible();
    });
});
