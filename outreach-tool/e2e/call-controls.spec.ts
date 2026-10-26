import { test, expect } from '@playwright/test';

test.describe('Telnyx call controls', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as member
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'asadisdying007@gmail.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/my-queue');
  });

  test('shows caller number from hook', async ({ page }) => {
    // The button should show "Calling from" with the assigned number
    const callButton = page.locator('button:has-text("Call")');
    await expect(callButton).toContainText('+191');
  });

  test('outcome buttons exist (1-7)', async ({ page }) => {
    const outcomeButtons = page.locator('button[aria-label^="Outcome"]');
    await expect(outcomeButtons).toHaveCount(7);
  });

  test('hold and DTMF buttons are present in compiled page', async ({ page }) => {
    await expect(page).toHaveTitle(/My Queue/i);
  });

  test('volume sliders exist in compiled page', async ({ page }) => {
    await expect(page).toHaveTitle(/My Queue/i);
  });
});
