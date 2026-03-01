import { test, expect } from '@playwright/test';

test.describe('Flujo de Sorteo y Configuración de Torneo', () => {

    test('Permite seleccionar asistencia, generar parejas e iniciar torneo superando el PinGuard', async ({ page }) => {
        // Navigate to Setup with a predefined host to skip the first modal
        await page.goto('/setup?host=Alex', { waitUntil: 'networkidle' });

        // Ensure we are not blocked by a "Highlander" tournament
        // Wait up to 3 seconds to see if the block modal appears after the spinner
        try {
            const blockerRefresh = page.locator('button', { hasText: 'quiero Reiniciar' });
            await blockerRefresh.waitFor({ state: 'visible', timeout: 3000 });
            // If we reach this line, the blocker is visible!
            page.on('dialog', dialog => dialog.accept());
            await blockerRefresh.click();
            await page.waitForLoadState('networkidle');
            // Re-navigate just in case
            await page.goto('/setup?host=Alex', { waitUntil: 'networkidle' });
            // Wait again for stability
            await page.waitForTimeout(1000);
        } catch (e) {
            // No Highlander block appeared, proceed normally
        }

        // Validate page loaded correctly
        await expect(page.locator('h1', { hasText: /Configuración de Jornada/i })).toBeVisible({ timeout: 20000 });

        // Select exactly 4 players
        const playersToSelect = ["Alex", "Beto", "Buru", "Carlos R"];

        for (const player of playersToSelect) {
            // Find the button directly by text to avoid complex parent navigation
            const btn = page.locator('button').filter({ hasText: player }).first();
            await btn.click({ force: true });
            // Small pause for Firefox stability
            await page.waitForTimeout(300);
        }

        // Validate the count marker says 4 Jugadores
        await expect(page.locator('span:has-text("4 Jugadores")')).toBeVisible();

        // Click the Sorteo button
        const sorteoBtn = page.locator('button', { hasText: 'Sortear Parejas' });
        await expect(sorteoBtn).toBeEnabled();
        await sorteoBtn.click();

        // Validate the results are shown
        await expect(page.locator('h2:has-text("Resultado del Sorteo")')).toBeVisible();
        await expect(page.locator('span:has-text("Pareja #1")')).toBeVisible();
        await expect(page.locator('span:has-text("Pareja #2")')).toBeVisible();

        // Click on Comenzar Torneo
        const saveBtn = page.locator('button', { hasText: 'Comenzar Torneo' });
        await expect(saveBtn).toBeEnabled();
        await saveBtn.click();

        // The PinGuard modal should appear
        await expect(page.getByRole('heading', { name: /Acceso Protegido|Guardar Jornada/i })).toBeVisible();

        // Input Pin "1111"
        // The buttons are pure numbers, we can find the one with exactly "1"
        const btn1 = page.locator('button', { hasText: /^1$/ }).first();
        await expect(btn1).toBeVisible();

        await btn1.click();
        await btn1.click();
        await btn1.click();
        await btn1.click();

        // Once the valid pin is entered, it should navigate automatically to Home
        await expect(page).toHaveURL(/.*\/(\?.*)?/, { timeout: 15000 });

        // It might be blocked if it goes to `/` and renders the home page
        // Wait and assert we are on the Home page by looking for the Trophy or Host Dropdown
        await expect(page.locator('button', { hasText: 'Anfitrión:' })).toBeVisible();
    });
});
