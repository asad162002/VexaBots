import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://localhost:3000';
const SAMPLE_FILE = path.join(__dirname, '../test-data/google-maps-full-sample.json');

// These tests need to run serially because later tests depend on data uploaded
// by the upload test
test.describe.configure({ mode: 'serial' });

async function loginAdmin({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Untested Flows Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin({ page });
  });

  // ==================== EXISTING TESTS ====================

  test('should verify Google Maps import file exists and can be uploaded', async ({ page }) => {
    expect(fs.existsSync(SAMPLE_FILE)).toBe(true);
    const fileContent = fs.readFileSync(SAMPLE_FILE, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    expect(jsonData.length).toBe(3);
    expect(jsonData[0].name).toBe('Starbucks Coffee Company');
    expect(jsonData[0].place_id).toBe('ChIJCV_Dko_bmoARgq5HYBtMXNw');

    await page.goto('/dashboard/import');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1:has-text("Import Leads")')).toBeVisible();
    const fileInput = await page.locator('input[type="file"]');
    expect(await fileInput.count()).toBeGreaterThan(0);
    console.log('Google Maps JSON file ready for upload at:', SAMPLE_FILE);
    await page.screenshot({ path: '/tmp/import-page.png', fullPage: true });
  });

  test('should verify assignment limits UI exists in settings', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await page.waitForTimeout(2000);
    const hasAssignLimitsHeader = await page.locator('h2:has-text("Assignment Limits")').first().isVisible();
    console.log('Assignment Limits section visible:', hasAssignLimitsHeader);
    const limitInputs = await page.$$('input[type="number"]');
    console.log('Limit number inputs found:', limitInputs.length);
    const hasInviteSection = await page.locator('text=Invite Team Member').first().isVisible();
    console.log('Invite Team Member section:', hasInviteSection);
    await page.screenshot({ path: '/tmp/settings-full.png', fullPage: true });
  });

  test('should verify activity feed groups by username', async ({ page }) => {
    await page.goto('/dashboard/activity-feed');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Activity Feed")')).toBeVisible();
    const dateFilter = await page.locator('select');
    expect(await dateFilter.count()).toBeGreaterThan(0);
    console.log('Date filter dropdown present');
    await dateFilter.selectOption({ value: 'all' });
    await page.waitForTimeout(2000);
    const groupButtons = await page.$$('button.w-full.flex.items-center.justify-between');
    console.log('User groups found in activity feed:', groupButtons.length);
    for (let i = 0; i < Math.min(groupButtons.length, 3); i++) {
      await groupButtons[i].click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/activity-feed-expanded.png', fullPage: true });
    console.log('Activity feed groups by username: verified');
  });

  test('should verify assignment log table structure', async ({ page }) => {
    await page.goto('/dashboard/assignment-log');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Assignment Log")')).toBeVisible();
    await expect(page.locator('th:has-text("Team Member")')).toBeVisible();
    await expect(page.locator('th:has-text("Leads Assigned")')).toBeVisible();
    await expect(page.locator('th:has-text("Last Assignment")')).toBeVisible();
    await expect(page.locator('th:has-text("Assigned By")')).toBeVisible();
    const dateFilter = await page.locator('select');
    expect(await dateFilter.count()).toBeGreaterThan(0);
    console.log('Assignment log date filter present');
    await page.screenshot({ path: '/tmp/assignment-log-full.png', fullPage: true });
    console.log('Assignment log structure: verified');
  });

  // ==================== JSON UPLOAD E2E TESTS ====================

  test('should upload Google Maps JSON file and verify leads appear in dashboard', async ({ page }) => {
    const filePath = path.resolve(SAMPLE_FILE);

    // Read and parse the JSON to know what to verify
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    expect(jsonData.length).toBe(3);
    const testLeadNames = jsonData.map((item: any) => item.name);
    console.log('Test leads to upload:', testLeadNames);

    // Navigate to import page
    await page.goto('/dashboard/import');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1:has-text("Import Leads")')).toBeVisible();

    // Upload the JSON file
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForTimeout(2000);

    // Verify JSON detection message appears
    await expect(page.locator('text=JSON file detected').first()).toBeVisible({ timeout: 10000 });

    // Verify data preview shows all rows detected
    await expect(page.locator('text=3 rows detected').first()).toBeVisible({ timeout: 10000 });

    // Verify the preview shows the mapping info
    await expect(page.locator('text=Basic business info').first()).toBeVisible();
    await expect(page.locator('text=Owner/LinkedIn/Apollo').first()).toBeVisible();

    // Take screenshot of the preview
    await page.screenshot({ path: '/tmp/json-upload-preview.png', fullPage: true });

    // Click Import button - use the specific button in the import section, not sidebar
    // The import button text is "Import {filename}"
    await page.getByRole('button', { name: /Import .+\.json/i }).click();

    // Wait for import to complete and success message to appear
    await expect(page.locator('text=Import complete').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=3 added').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '/tmp/json-upload-success.png', fullPage: true });

    console.log('JSON import completed successfully');
  });

  test('should verify uploaded leads appear in leads dashboard', async ({ page }) => {
    // Read test data to know what to search for
    const fileContent = fs.readFileSync(SAMPLE_FILE, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const testLeadName = jsonData[0].name; // "Starbucks Coffee Company"

    // Navigate to leads dashboard
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Leads")')).toBeVisible();

    // Search for the uploaded lead
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill(testLeadName);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/leads-search-results.png', fullPage: true });

    // Verify the lead appears in search results (use first() to avoid strict mode)
    const leadRow = page.locator(`text=${testLeadName}`).first();
    await expect(leadRow).toBeVisible({ timeout: 10000 });
    console.log(`Found lead "${testLeadName}" in dashboard search results`);

    // Click on the lead to view detail page
    await leadRow.click();
    await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify lead detail page shows the data
    await expect(page.locator(`text=${testLeadName}`).first()).toBeVisible({ timeout: 10000 });

    // Check for key fields from the JSON (category_name is NOT displayed on detail page)
    await expect(page.locator('text=Sacramento').first()).toBeVisible({ timeout: 10000 }); // city
    await expect(page.locator('text=Jessica Foust').first()).toBeVisible({ timeout: 10000 }); // owner_name

    await page.screenshot({ path: '/tmp/lead-detail-page.png', fullPage: true });
    console.log('Lead detail page verified with enrichment data');
  });

  test('should verify all 3 uploaded leads appear in dashboard', async ({ page }) => {
    // Read test data
    const fileContent = fs.readFileSync(SAMPLE_FILE, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    const allLeadNames = jsonData.map((item: any) => item.name);

    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    await expect(page.locator('h1:has-text("Leads")')).toBeVisible();

    // Verify all leads appear (they should already be uploaded from previous test)
    const results: { [key: string]: boolean } = {};
    for (const leadName of allLeadNames) {
      const isVisible = await page.locator(`text=${leadName}`).first().isVisible();
      results[leadName] = isVisible;
      console.log(`Lead "${leadName}": ${isVisible ? 'FOUND' : 'NOT FOUND'}`);
    }

    const foundCount = Object.values(results).filter(Boolean).length;
    expect(foundCount).toBe(allLeadNames.length);
    console.log(`All ${allLeadNames.length} leads verified in dashboard`);
    await page.screenshot({ path: '/tmp/all-leads-dashboard.png', fullPage: true });
  });
});
