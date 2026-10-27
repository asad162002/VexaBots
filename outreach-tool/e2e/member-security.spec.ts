import { test, expect } from '@playwright/test';

test.describe('Member access restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'asadisdying007@gmail.com');
    await page.fill('input[name="password"]', 'test1234');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/my-queue');
  });

  test('member lands on My Queue', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp('\\/dashboard\\/my-queue'));
  });

  test('member is redirected from Leads list to My Queue', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForURL('**/dashboard/my-queue');
  });

  test('member is redirected from Call Dialer to My Queue', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/calls');
    await page.waitForURL('**/dashboard/my-queue');
  });

  test('member does not see admin-only sidebar links', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/my-queue');
    await page.waitForTimeout(500);

    for (const label of ['Assignment Log', 'Add Lead', 'Import CSV/JSON']) {
      await expect(page.getByRole('link', { name: label })).toHaveCount(0);
    }
  });

  test('member sees allowed sidebar links', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/my-queue');
    await page.waitForTimeout(500);

    await expect(page.getByRole('link', { name: 'My Queue' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Activity Feed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
});
