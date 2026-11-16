import { test, expect } from '@playwright/test';

test.describe('Member access restrictions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/');
    await page.locator('#email').fill('asadisdying007@gmail.com');
    await page.locator('#password').fill('test1234');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
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

    for (const label of ['Assignment Log', 'Import CSV/JSON']) {
      await expect(page.getByRole('link', { name: label })).toHaveCount(0);
    }
  });

  test('member sees Add Lead in the sidebar', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/my-queue');
    await page.waitForTimeout(500);

    await expect(page.getByRole('link', { name: 'Add Lead' })).toBeVisible();
  });

  test('member can open Add Lead without being redirected', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/leads/new');
    await page.waitForTimeout(1500);

    await expect(page).toHaveURL(/\/dashboard\/leads\/new$/);
    await expect(page.getByRole('heading', { name: 'Add Lead' })).toBeVisible();
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
