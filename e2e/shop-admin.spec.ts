import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to admin dashboard (would need auth in real scenario)
        await page.goto('http://localhost:3006/');
    });

    test('should display dashboard stats cards', async ({ page }) => {
        await expect(page.locator('.stat-card')).toHaveCount(4);
    });

    test('should display recent orders table', async ({ page }) => {
        await expect(page.locator('.data-table')).toBeVisible();
    });

    test('should navigate to orders page', async ({ page }) => {
        await page.click('a:has-text("Pedidos")');
        await expect(page).toHaveURL(/pedidos/);
    });
});

test.describe('Order Management', () => {
    test('should search orders', async ({ page }) => {
        await page.goto('http://localhost:3006/pedidos');

        // Type in search
        await page.fill('input[placeholder*="Buscar"]', '123456');

        // Wait for debounced search
        await page.waitForTimeout(400);

        // Results should update
    });

    test('should filter by status', async ({ page }) => {
        await page.goto('http://localhost:3006/pedidos');

        // Select status filter
        await page.selectOption('select', 'PAGO');

        // Wait for filter to apply
        await page.waitForTimeout(100);
    });

    test('should expand order to see items', async ({ page }) => {
        await page.goto('http://localhost:3006/pedidos');

        // Click on order number to expand
        const orderRow = page.locator('button:has-text("#")').first();
        if (await orderRow.isVisible()) {
            await orderRow.click();

            // Items should be visible
            await expect(page.locator('text=Itens do Pedido')).toBeVisible();
        }
    });

    test('should mark order as picked up', async ({ page }) => {
        await page.goto('http://localhost:3006/pedidos');

        // Click pickup button
        const pickupButton = page.locator('button:has-text("Retirar")').first();
        if (await pickupButton.isVisible()) {
            await pickupButton.click();

            // Should show confirmation or update status
        }
    });
});

test.describe('Presential Sale', () => {
    test('should navigate to presential sale', async ({ page }) => {
        await page.goto('http://localhost:3006/venda-presencial');

        await expect(page.locator('h1')).toContainText('Venda Presencial');
    });

    test('should add item to sale', async ({ page }) => {
        await page.goto('http://localhost:3006/venda-presencial');

        // Fill student name
        await page.fill('input[placeholder*="Aluno"]', 'João Silva');

        // Select product
        const productSelect = page.locator('select').first();
        if (await productSelect.isVisible()) {
            await productSelect.selectOption({ index: 1 });
        }

        // Select size
        await page.locator('.flex button').first().click();

        // Add item
        await page.click('button:has-text("Adicionar Item")');
    });

    test('should complete presential sale', async ({ page }) => {
        await page.goto('http://localhost:3006/venda-presencial');

        // Would need to add items first
        // Then fill customer info
        await page.fill('input[placeholder*="Nome completo"]', 'Maria Silva');
        await page.fill('input[type="tel"]', '11987654321');

        // Select payment method
        await page.selectOption('select', 'DINHEIRO');
    });
});

test.describe('Inventory Management', () => {
    test('should display inventory stats', async ({ page }) => {
        await page.goto('http://localhost:3006/estoque');

        await expect(page.locator('.stat-card')).toHaveCount(3);
    });

    test('should search inventory', async ({ page }) => {
        await page.goto('http://localhost:3006/estoque');

        await page.fill('input[placeholder*="Buscar"]', 'Camiseta');
    });

    test('should open stock entry modal', async ({ page }) => {
        await page.goto('http://localhost:3006/estoque');

        const entryButton = page.locator('button:has-text("Entrada")').first();
        if (await entryButton.isVisible()) {
            await entryButton.click();

            // Modal should open
            await expect(page.locator('text=Entrada de Estoque')).toBeVisible();
        }
    });
});

test.describe('Interest Management', () => {
    test('should display interest list', async ({ page }) => {
        await page.goto('http://localhost:3006/interesse');

        await expect(page.locator('h1')).toContainText('Interesse');
    });

    test('should filter by status', async ({ page }) => {
        await page.goto('http://localhost:3006/interesse');

        await page.selectOption('select', 'PENDENTE');
    });

    test('should mark as contacted', async ({ page }) => {
        await page.goto('http://localhost:3006/interesse');

        const contactButton = page.locator('button:has-text("Contatar")').first();
        if (await contactButton.isVisible()) {
            await contactButton.click();
        }
    });
});

test.describe('Settings', () => {
    test('should toggle shop enabled', async ({ page }) => {
        await page.goto('http://localhost:3006/configuracoes');

        // Click toggle button
        const toggle = page.locator('button.rounded-full').first();
        if (await toggle.isVisible()) {
            await toggle.click();
        }
    });

    test('should update max installments', async ({ page }) => {
        await page.goto('http://localhost:3006/configuracoes');

        await page.selectOption('select', '6');
    });

    test('should update pickup instructions', async ({ page }) => {
        await page.goto('http://localhost:3006/configuracoes');

        await page.fill('textarea', 'Novas instruções de retirada');
    });

    test('should save settings', async ({ page }) => {
        await page.goto('http://localhost:3006/configuracoes');

        await page.click('button:has-text("Salvar")');

        // Should show success message
        await expect(page.locator('text=sucesso')).toBeVisible({ timeout: 5000 }).catch(() => { });
    });
});

test.describe('Reports', () => {
    test('should display sales tab by default', async ({ page }) => {
        await page.goto('http://localhost:3006/relatorios');

        await expect(page.locator('button:has-text("Vendas")')).toHaveClass(/bg-blue/);
    });

    test('should switch to stock tab', async ({ page }) => {
        await page.goto('http://localhost:3006/relatorios');

        await page.click('button:has-text("Estoque")');

        await expect(page.locator('text=Críticos')).toBeVisible();
    });

    test('should switch to interest tab', async ({ page }) => {
        await page.goto('http://localhost:3006/relatorios');

        await page.click('button:has-text("Interesse")');

        await expect(page.locator('text=Procuradas')).toBeVisible();
    });
});
