import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAsync({ page }: { page: import('@playwright/test').Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Phase 3 Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsync({ page });
  });

  test('should show assignment limits in settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.locator('h2:has-text("Assignment Limits")')).toBeVisible();
  });

  test('should show activity feed page', async ({ page }) => {
    await page.goto('/dashboard/activity-feed');
    await expect(page.locator('h1:has-text("Activity Feed")')).toBeVisible();
  });

  test('should show analytics page', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
  });

  test('should show assignment log page', async ({ page }) => {
    await page.goto('/dashboard/assignment-log');
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();
  });

  test('should have activity feed in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Activity Feed' })).toBeVisible();
  });

  test('should have analytics in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  });
});
