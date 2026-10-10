import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAsync({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Phase 3 End-to-End Functional Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsync({ page });
  });

  test('should create a lead and log activity', async ({ page }) => {
    const leadName = 'E2E Activity Test ' + Date.now();
    
    // 1. Create a new lead
    await page.goto('/dashboard/leads/new');
    await page.locator('input[name="title"]').fill(leadName);
    await page.locator('input[name="phone"]').fill('+923001234567');
    await page.locator('input[name="city"]').fill('Lahore');
    await page.locator('input[name="owner_name"]').fill('Test Owner');
    await page.locator('textarea[name="notes"]').fill('E2E test note');
    await page.getByRole('button', { name: /Add Lead/i }).click();
    await page.waitForURL('/dashboard');
    await page.waitForTimeout(2000);
    
    // 2. Find the lead in the list and click it
    const leadLinks = await page.$$(`a:has-text("${leadName}")`);
    expect(leadLinks.length > 0).toBeTruthy();
    await leadLinks[0].click();
    await page.waitForURL(/\/dashboard\/leads\/[^\/]+$/);
    await page.waitForTimeout(3000);
    
    // 3. Verify activity log section is visible
    await expect(page.locator('h2:has-text("Activity Log")')).toBeVisible({ timeout: 10000 });
    
    // 4. Click "+ Log Activity" to show the form
    await page.locator('text=Log Activity').first().click();
    await page.waitForTimeout(2000);
    
    // 5. Verify form fields exist
    await expect(page.locator('#activity-type')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#activity-content')).toBeVisible();
    await expect(page.locator('#activity-outcome')).toBeVisible();
    await expect(page.locator('#activity-follow-up')).toBeVisible();
    
    // 6. Log an activity
    await page.selectOption('#activity-type', 'call');
    await page.fill('#activity-content', 'Called client - interested in service');
    await page.fill('#activity-outcome', 'Will follow up next week');
    await page.fill('#activity-follow-up', '2025-02-15');
    const saveButton = await page.locator('button').filter({ hasText: 'Save' }).last();
    await saveButton.click();
    await page.waitForTimeout(3000);
    
    // 7. Verify activity appears in the log on lead detail
    const activityVisible = await page.locator('text=CALLED CLIENT').or(
      page.locator('text=Called client')
    ).first().isVisible();
    expect(activityVisible).toBe(true);
    
    // 8. Check activity feed shows the new activity
    await page.goto('/dashboard/activity-feed');
    await page.waitForTimeout(3000);
    const feedHasActivity = await page.locator('text=CALLED CLIENT').or(
      page.locator('text=Called client')
    ).first().isVisible();
    expect(feedHasActivity).toBe(true);
    
    console.log('E2E test passed: created lead, logged activity, verified in feed');
  });

  test('should show assignment log', async ({ page }) => {
    await page.goto('/dashboard/assignment-log');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();
  });

  test('should show analytics with key sections', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('h2:has-text("Team Performance")')).toBeVisible();
    await expect(page.locator('h2:has-text("Lead Status Distribution")')).toBeVisible();
    await expect(page.locator('h2:has-text("Lead Source Distribution")')).toBeVisible();
  });

  test('should show assignment limits in settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);
    await expect(page.locator('h2:has-text("Assignment Limits")')).toBeVisible();
  });

  test('should show activity feed and analytics in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('link', { name: 'Activity Feed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
  });
});
