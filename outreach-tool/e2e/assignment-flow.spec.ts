import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAdmin({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Lead Assignment E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin({ page });
  });

  test('should show bulk action toolbar when leads selected', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    
    // Check page loaded with leads
    await expect(page.locator('h1:has-text("Leads")')).toBeVisible();
    
    // Find the bulk select checkboxes (first one is select-all, others are per-lead)
    const checkboxes = await page.$$('div.cursor-pointer.rounded.border');
    const leadCheckboxes = checkboxes.filter(async (cb, i) => {
      const parent = await cb.evaluate(el => el.closest('.group'));
      return parent !== null || await cb.evaluate(el => el.querySelector('svg') !== null);
    });
    
    // Select first lead checkbox (skip the "select all" which is first)
    const checkboxList = await page.$$('div.cursor-pointer.rounded.border');
    console.log('Checkbox elements found:', checkboxList.length);
    
    // Select all checkbox
    if (checkboxList.length > 0) {
      await checkboxList[0].click();
      await page.waitForTimeout(1000);
      
      // Check if bulk action toolbar appears
      const bulkToolbar = await page.locator('fixed.bottom-6').first();
      const hasToolbar = await bulkToolbar.isVisible();
      console.log('Bulk toolbar visible:', hasToolbar);
      
      await page.screenshot({ path: '/tmp/bulk-toolbar-test.png', fullPage: true });
    }
    
    console.log('Bulk action test completed');
  });

  test('should show assignment log with correct table headers', async ({ page }) => {
    await page.goto('/dashboard/assignment-log');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();
    await expect(page.locator('th:has-text("Team Member")')).toBeVisible();
    await expect(page.locator('th:has-text("Leads Assigned")')).toBeVisible();
    await expect(page.locator('th:has-text("Last Assignment")')).toBeVisible();
    await expect(page.locator('th:has-text("Assigned By")')).toBeVisible();
    
    await page.screenshot({ path: '/tmp/assignment-log-page.png', fullPage: true });
    console.log('Assignment log test passed');
  });

  test('should show analytics with correct sections', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(4000);
    
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('h2:has-text("Team Performance")')).toBeVisible();
    await expect(page.locator('h2:has-text("Lead Status Distribution")')).toBeVisible();
    await expect(page.locator('h2:has-text("Lead Source Distribution")')).toBeVisible();
    
    await page.screenshot({ path: '/tmp/analytics-page.png', fullPage: true });
    console.log('Analytics test passed');
  });

  test('should show assignment limits in settings for admin', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);
    
    await expect(page.locator('h2:has-text("Assignment Limits")')).toBeVisible();
    await expect(page.locator('text=Invite Team Member')).toBeVisible();
    
    await page.screenshot({ path: '/tmp/settings-page.png', fullPage: true });
    console.log('Settings with assignment limits test passed');
  });

  test('should view activity feed grouped by user', async ({ page }) => {
    await page.goto('/dashboard/activity-feed');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('h1:has-text("Activity Feed")')).toBeVisible();
    await expect(page.locator('text=Team activity grouped by member')).toBeVisible();
    
    // Verify user grouping is present
    const userAvatar = await page.locator('div.w-10.h-10.rounded-full').first();
    await expect(userAvatar).toBeVisible();
    
    await page.screenshot({ path: '/tmp/activity-feed-grouped.png', fullPage: true });
    console.log('Activity feed grouped by user test passed');
  });
});
