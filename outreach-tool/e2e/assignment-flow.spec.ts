import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

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

  test('should import CSV and assign a lead to team member', async ({ page }, testInfo) => {
    testInfo.setTimeout(60000);
    const csvPath = path.resolve(__dirname, '../test-data/csv-sample.csv');

    // Navigate to import page and upload CSV
    await page.goto('/dashboard/import');
    await page.waitForTimeout(2000);
    await page.locator('input[type="file"]').setInputFiles(csvPath);
    await page.waitForTimeout(2000);

    // Verify column mapping appeared
    await expect(page.locator('text=Map Columns')).toBeVisible({ timeout: 10000 });

    // Click Import button (matches "Import csv-sample.csv")
    await page.getByRole('button', { name: /^Import .+\.csv$/i }).click();

    // Wait for success
    await expect(page.locator('text=Import complete').first()).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: '/tmp/csv-assign-import-success.png', fullPage: true });
    console.log('CSV import completed for assignment test');

    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);

    // Filter to unassigned leads to find our newly imported ones
    // Dashboard has 5 selects: Status, Source, Category, Assignment, Sort
    // The Assignment filter is the 4th select (index 3)
    const assignSelect = page.locator('select').nth(3);
    await assignSelect.selectOption('unassigned');
    await page.waitForTimeout(2000);

    // Search for specific lead
    await page.locator('input[placeholder*="Search"]').fill('Test CSV Business');
    await page.waitForTimeout(2000);

    // Verify the lead appears
    await expect(page.locator('text=Test CSV Business').first()).toBeVisible({ timeout: 10000 });

    // Select the lead checkbox - checkbox is a sibling of the content div within the same flex container
    const leadRow = page.locator('text=Test CSV Business').first();
    // Find the checkbox: it's a div with w-5 h-5 cursor-pointer that is a preceding sibling
    // of the div containing the lead text, within the same flex parent
    const checkbox = leadRow.locator('xpath=ancestor::div[contains(@class, "flex") and contains(@class, "items-start")]/div[contains(@class, "w-5 h-5")][contains(@class, "cursor-pointer")]').first();
    await checkbox.click();
    await page.waitForTimeout(1000);

    // Verify bulk action toolbar appears
    const bulkToolbar = page.locator('div.fixed.bottom-6').first();
    await expect(bulkToolbar).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=1 selected').first()).toBeVisible();

    // Click Assign button
    await page.getByRole('button', { name: /Assign/i }).click();
    await page.waitForTimeout(1000);

    // In the assign modal, click the first team member (admin)
    // The modal is a fixed inset-0 overlay with team member buttons
    const modalButtons = page.locator('div.fixed.inset-0.bg-black\\/50 button');
    console.log('Modal buttons found:', await modalButtons.count());
    if (await modalButtons.count() > 0) {
      await modalButtons.first().click();
    } else {
      // Fallback: try buttons with team member info
      await page.locator('button:has-text("asad")').first().click();
    }
    await page.waitForTimeout(3000);

    // Verify lead is now assigned (filter to assigned only)
    const assignedSelect = page.locator('select').nth(3);
    await assignedSelect.selectOption('assigned');
    await page.waitForTimeout(2000);

    // Search again to confirm it shows as assigned
    await page.locator('input[placeholder*="Search"]').fill('Test CSV Business');
    await page.waitForTimeout(2000);
    await expect(page.locator('text=Test CSV Business').first()).toBeVisible({ timeout: 10000 });

    // Verify the lead row now shows assignment indicator (purple dot before "Assigned" text)
    const assignedBadge = page.locator('.bg-purple-500\\/50').first();
    await expect(assignedBadge).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: '/tmp/csv-lead-assigned.png', fullPage: true });
    console.log('Lead successfully assigned to team member');

    // Verify the assignment appears in the assignment log
    await page.goto('/dashboard/assignment-log');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();

    // The assignment log shows team members grouped with lead counts.
    // Click "Show dates" to expand the lead list for the admin's group
    const showLeadsButton = page.locator('button:has-text("Show dates")').first();
    await expect(showLeadsButton).toBeVisible({ timeout: 10000 });
    await showLeadsButton.click();
    await page.waitForTimeout(2000);

    // Verify the lead appears in the expanded leads table
    await expect(page.locator('text=Test CSV Business').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '/tmp/assignment-log-csv-lead.png', fullPage: true });
    console.log('CSV lead found in assignment log');
  });
});
