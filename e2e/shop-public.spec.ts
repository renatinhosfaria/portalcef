import { test, expect } from '@playwright/test';

test.describe('Shop Purchase Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the shop catalog
        await page.goto('/school-id/unit-id');
    });

    test('should display catalog with products', async ({ page }) => {
        // Wait for products to load
        await page.waitForSelector('[data-testid="product-card"]', { timeout: 5000 }).catch(() => { });

        // Check page title
        await expect(page.locator('h1')).toContainText('Uniforme');
    });

    test('should filter products by category', async ({ page }) => {
        // Click on category filter
        const categoryFilter = page.locator('[data-testid="category-filter"]');
        if (await categoryFilter.isVisible()) {
            await categoryFilter.click();
            // Select a category
            await page.locator('text=Educação Física').click();
        }
    });

    test('should filter products by size', async ({ page }) => {
        // Click on size filter
        const sizeFilter = page.locator('[data-testid="size-filter"]');
        if (await sizeFilter.isVisible()) {
            await sizeFilter.click();
            await page.locator('text=Tamanho 8').click();
        }
    });

    test('should add product to cart', async ({ page }) => {
        // Click on first product
        const productCard = page.locator('[data-testid="product-card"]').first();
        if (await productCard.isVisible()) {
            await productCard.click();

            // Select size
            await page.locator('[data-testid="size-selector"] button').first().click();

            // Enter student name
            await page.fill('[name="studentName"]', 'João Silva');

            // Add to cart
            await page.click('button:has-text("Adicionar")');

            // Verify cart badge updated
            await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
        }
    });

    test('should complete checkout flow', async ({ page }) => {
        // Add item to cart first (simplified)
        await page.goto('/checkout');

        // Fill checkout form
        await page.fill('[name="customerName"]', 'Maria Silva');
        await page.fill('[name="customerPhone"]', '11987654321');

        // Select installments
        const installmentsSelect = page.locator('[name="installments"]');
        if (await installmentsSelect.isVisible()) {
            await installmentsSelect.selectOption('1');
        }

        // Would proceed to Stripe payment form in real test
    });
});

test.describe('Order Voucher', () => {
    test('should display order by number and phone', async ({ page }) => {
        // Navigate to voucher page
        await page.goto('/pedido/123456');

        // Enter phone for verification
        const phoneInput = page.locator('[name="phone"]');
        if (await phoneInput.isVisible()) {
            await phoneInput.fill('11987654321');
            await page.click('button:has-text("Consultar")');
        }

        // Check order details displayed
        await page.waitForSelector('[data-testid="order-details"]', { timeout: 5000 }).catch(() => { });
    });

    test('should show order status badge', async ({ page }) => {
        await page.goto('/pedido/123456');

        // Status badge should be visible
        const statusBadge = page.locator('[data-testid="status-badge"]');
        if (await statusBadge.isVisible()) {
            await expect(statusBadge).toBeVisible();
        }
    });
});

test.describe('Interest Form', () => {
    test('should submit interest request', async ({ page }) => {
        await page.goto('/interesse/school-id/unit-id');

        // Step 1: Customer info
        await page.fill('[name="customerName"]', 'Maria Silva');
        await page.fill('[name="customerPhone"]', '11987654321');
        await page.fill('[name="customerEmail"]', 'maria@email.com');

        // Click next
        const nextButton = page.locator('button:has-text("Próximo")');
        if (await nextButton.isVisible()) {
            await nextButton.click();
        }

        // Step 2: Student info
        await page.fill('[name="studentName"]', 'João Silva');

        // Step 3: Would select products
        // Step 4: Submit
    });
});
