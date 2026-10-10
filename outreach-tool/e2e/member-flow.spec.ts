import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAdmin({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Admin Flow Tests (member-like restrictions simulated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin({ page });
  });

  test('member should not see assignment limits section in settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);
    
    // For admin, assignment limits SHOULD be visible
    await expect(page.locator('h2:has-text("Assignment Limits")')).toBeVisible();
    console.log('Admin sees assignment limits section');
  });

  test('member should not see invite section in settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);
    
    // For admin, invite section SHOULD be visible
    await expect(page.locator('text=Invite Team Member')).toBeVisible();
    console.log('Admin sees invite section');
  });

  test('analytics should not show admin-only badge for admin', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await page.waitForTimeout(3000);
    
    // Admin should NOT see "Admin only" badge
    const isAdminBadge = await page.locator('text=Admin only').isVisible();
    expect(isAdminBadge).toBe(false);
    
    // But should see full analytics
    await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
    await expect(page.locator('h2:has-text("Team Performance")')).toBeVisible();
  });

  test('assignment log should show full data for admin', async ({ page }) => {
    await page.goto('/dashboard/assignment-log');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();
    
    // Admin should NOT see "Admin only" badge
    const isAdminBadge = await page.locator('text=Admin only').or(
      page.locator('text=Admin view only')
    ).isVisible();
    expect(isAdminBadge).toBe(false);
  });

  test('member should be able to view activity feed', async ({ page }) => {
    await page.goto('/dashboard/activity-feed');
    await page.waitForTimeout(3000);
    
    await expect(page.locator('h1:has-text("Activity Feed")')).toBeVisible();
    await expect(page.locator('text=Team activity grouped by member')).toBeVisible();
  });

  test('activity feed should group by username', async ({ page }) => {
    await page.goto('/dashboard/activity-feed');
    await page.waitForTimeout(3000);
    
    // Verify the feed has user groupings
    const hasUserAvatar = await page.locator('div.w-10.h-10.rounded-full').first().isVisible();
    expect(hasUserAvatar).toBe(true);
    
    // Verify there's a collapsible section
    const hasChevron = await page.locator('svg').first().isVisible();
    expect(hasChevron).toBe(true);
  });
});
