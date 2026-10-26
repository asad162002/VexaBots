import { test, expect } from '@playwright/test';

test.describe('Member access restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.locator('#email').fill('asadisdying007@gmail.com');
    await page.locator('#password').fill('test1234');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
  });

  test('member lands on My Queue and not /dashboard', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp('\\/dashboard\\/my-queue'));
  });

  test('member is redirected from Leads list to My Queue', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard/my-queue', { timeout: 10000 });
  });

  test('member is redirected from Call Dialer to My Queue', async ({ page }) => {
    await page.goto('/dashboard/calls');
    await page.waitForURL('**/dashboard/my-queue', { timeout: 10000 });
  });

  test('member does not see admin-only sidebar links', async ({ page }) => {
    await page.goto('/dashboard/my-queue');
    await page.waitForTimeout(1000);

    const labels = ['Leads', 'Call Dialer', 'LinkedIn Leads', 'Assignment Log', 'Add Lead', 'Import CSV/JSON'];
    for (const label of labels) {
      await expect(page.getByRole('link', { name: label })).toHaveCount(0);
    }
  });

  test('member sees allowed sidebar links', async ({ page }) => {
    await page.goto('/dashboard/my-queue');
    await page.waitForTimeout(1000);

    await expect(page.getByRole('link', { name: 'My Queue' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Feed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
});
