import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const SAMPLE_FILE = path.join(__dirname, '../test-data/google-maps-full-sample.json');

export async function loginAdmin({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

// JSON upload tests must run serially - later tests depend on data from the upload test
test.describe.configure({ mode: 'serial' });

test.describe('JSON Import E2E Tests', () => {
  test('should upload Google Maps JSON file and verify leads appear in dashboard', async ({ page }) => {
    const filePath = path.resolve(SAMPLE_FILE);

    // Read and parse the JSON to know what to verify
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const jsonData = JSON.parse(fileContent);
    expect(jsonData.length).toBe(3);
    const testLeadNames = jsonData.map((item: any) => item.name);
    console.log('Test leads to upload:', testLeadNames);

    // Login
    await loginAdmin({ page });

    // Navigate to import page
    await page.goto('/dashboard/import');
    await page.waitForTimeout(2000);
    await expect(page.locator('h1:has-text("Import")')).toBeVisible();

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

    // Click Import button - matches "Import google-maps-full-sample.json"
    await page.getByRole('button', { name: /Import .+\.json/i }).click();

    // Wait for import to complete and success message to appear
    await expect(page.locator('text=Import complete').first()).toBeVisible({ timeout: 30000 });
    await expect(page.locator('text=3 added').first()).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: '/tmp/json-upload-success.png', fullPage: true });

    console.log('JSON import completed successfully');
  });

  test('should verify uploaded leads appear in leads dashboard', async ({ page }) => {
    // Login
    await loginAdmin({ page });

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

    // Verify the lead appears in search results
    const leadRow = page.locator(`text=${testLeadName}`).first();
    await expect(leadRow).toBeVisible({ timeout: 10000 });
    console.log(`Found lead "${testLeadName}" in dashboard search results`);

    // Click on the lead to view detail page
    await leadRow.click();
    await page.waitForURL(/\/dashboard\/leads\/[^\/]+$/, { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Verify lead detail page shows the data
    await expect(page.locator(`text=${testLeadName}`).first()).toBeVisible({ timeout: 10000 });

    // Check for key fields from the JSON
    await expect(page.locator('text=Sacramento').first()).toBeVisible({ timeout: 10000 }); // city
    await expect(page.locator('text=Jessica Foust').first()).toBeVisible({ timeout: 10000 }); // owner_name
    await expect(page.locator('text=Owner / Contact').first()).toBeVisible({ timeout: 10000 }); // owner section header

    await page.screenshot({ path: '/tmp/lead-detail-page.png', fullPage: true });
    console.log('Lead detail page verified with enrichment data');
  });

  test('should verify all 3 uploaded leads appear in dashboard', async ({ page }) => {
    // Login
    await loginAdmin({ page });

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
