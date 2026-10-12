import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const SAMPLE_FILE = path.join(__dirname, '../test-data/google-maps-full-sample.json');

async function loginAdmin({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Lead Detail Page Tests', () => {
  test.describe.configure({ mode: 'serial' });

  // Upload test data once before all tests
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAdmin({ page });
    await page.goto('/dashboard/import');
    await page.waitForTimeout(2000);
    const filePath = path.resolve(SAMPLE_FILE);
    await page.locator('input[type="file"]').setInputFiles(filePath);
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: /Import .+\.json/i }).click();
    await expect(page.locator('text=Import complete').first()).toBeVisible({ timeout: 30000 });
    await page.close();
  });

  test.describe('Status Change Tests', () => {
    test.beforeEach(async ({ page }) => {
      await loginAdmin({ page });
    });

    test('should change lead status and verify it persists', async ({ page }) => {
      const testInfo = test.info();
      testInfo.setTimeout(60000);

      // Navigate to dashboard and find a lead
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);

      // Search for Starbucks lead
      await page.locator('input[placeholder*="Search"]').fill('Starbucks');
      await page.waitForTimeout(2000);

      // Click on the lead to view detail page
      await page.locator('text=Starbucks Coffee Company').first().click();
      await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Verify the status badge shows "New"
      await expect(page.locator('text=New').first()).toBeVisible();

      // Find the status select in the Update section and change it to "Contacted"
      // The status select is the one with option "New"
      const statusSelect = page.locator('select').filter({ hasText: 'New' });
      await expect(statusSelect).toBeVisible({ timeout: 10000 });
      await statusSelect.selectOption('contacted');
      await page.waitForTimeout(500);

      // Click Save Changes
      await page.getByRole('button', { name: /Save Changes/i }).click();
      await page.waitForTimeout(3000);

      // Verify the status badge updated to "Contacted"
      await expect(page.locator('text=Contacted').first()).toBeVisible({ timeout: 10000 });
      await page.screenshot({ path: '/tmp/status-changed-contacted.png', fullPage: true });
      console.log('Lead status changed from New to Contacted and verified');
    });
  });

  test.describe('Activity Log Tests', () => {
    test.beforeEach(async ({ page }) => {
      await loginAdmin({ page });
    });

    test('should log an activity with call type and verify it appears in activity log', async ({ page }) => {
      const testInfo = test.info();
      testInfo.setTimeout(60000);

      // Navigate to dashboard and find a lead
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
      await page.locator('input[placeholder*="Search"]').fill('Starbucks');
      await page.waitForTimeout(2000);

      // Click on the lead
      await page.locator('text=Starbucks Coffee Company').first().click();
      await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Verify the Activity Log section exists
      await expect(page.locator('text=Activity Log').first()).toBeVisible();

      // Check for existing activities state
      const hasNoActivities = await page.locator('text=No activities logged yet').first().isVisible();
      console.log('Has empty activity state:', hasNoActivities);

      // Click "+ Log Activity" button to expand the form
      await page.getByRole('button', { name: /\+ Log Activity/i }).click();
      await page.waitForTimeout(1000);

      // Verify the activity form appeared
      await expect(page.locator('text=Type')).toBeVisible();
      await expect(page.locator('#activity-type')).toBeVisible();
      await expect(page.locator('#activity-content')).toBeVisible();

      // Fill in the activity form with call type
      await page.locator('#activity-type').selectOption('call');
      await page.locator('#activity-content').fill('Called the business about potential partnership. Left a voicemail.');
      await page.locator('#activity-outcome').fill('No answer - voicemail left');

      // Submit the activity - the submit button says "Save"
      await page.getByRole('button', { name: /^Save$/i }).click();
      await page.waitForTimeout(3000);

      // Verify the activity appears in the log
      await expect(page.locator('text=CALLED THE BUSINESS ABOUT POTENTIAL PARTNERSHIP').first()).toBeVisible({ timeout: 10000 });

      // Verify the outcome text
      await expect(page.locator('text=No answer - voicemail left').first()).toBeVisible({ timeout: 10000 });

      // Verify the activity type badge shows "Call" (in a span.rounded-full)
      await expect(page.locator('span.rounded-full', { hasText: 'Call' }).first()).toBeVisible({ timeout: 10000 });

      await page.screenshot({ path: '/tmp/activity-log-call.png', fullPage: true });
      console.log('Activity logged with call type and verified in log');
    });

    test('should log an activity with meeting type and outcome', async ({ page }) => {
      const testInfo = test.info();
      testInfo.setTimeout(60000);

      // Navigate to the lead
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
      await page.locator('input[placeholder*="Search"]').fill('Starbucks');
      await page.waitForTimeout(2000);
      await page.locator('text=Starbucks Coffee Company').first().click();
      await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Click "+ Log Activity"
      await page.getByRole('button', { name: /\+ Log Activity/i }).click();
      await page.waitForTimeout(1000);

      // Fill in with meeting type
      await page.locator('#activity-type').selectOption('meeting');
      await page.locator('#activity-content').fill('Scheduled a follow-up meeting for next week to discuss the campaign.');
      await page.locator('#activity-outcome').fill('Meeting booked');

      // Submit
      await page.getByRole('button', { name: /^Save$/i }).click();
      await page.waitForTimeout(3000);

      // Verify the activity appears with Meeting type badge
      await expect(page.locator('span.rounded-full', { hasText: 'Meeting' }).first()).toBeVisible({ timeout: 10000 });
      // "Meeting booked" text also appears as a hidden option in status select
      // Use text-gray-400 span which is the outcome display class
      await expect(page.locator('span.text-xs.text-gray-400', { hasText: 'Meeting booked' }).first()).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Scheduled a follow-up meeting').first()).toBeVisible({ timeout: 10000 });

      await page.screenshot({ path: '/tmp/activity-log-meeting.png', fullPage: true });
      console.log('Activity logged with meeting type and verified in log');
    });
  });

  test.describe('Lead Detail UI Tests', () => {
    test.beforeEach(async ({ page }) => {
      await loginAdmin({ page });
    });

    test('should show all detail page sections for an enriched lead', async ({ page }) => {
      const testInfo = test.info();
      testInfo.setTimeout(60000);

      // Navigate to the Starbucks lead
      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
      await page.locator('input[placeholder*="Search"]').fill('Starbucks');
      await page.waitForTimeout(2000);
      await page.locator('text=Starbucks Coffee Company').first().click();
      await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Verify Quick Info section
      await expect(page.locator('text=Quick Info').first()).toBeVisible();
      await expect(page.locator('text=Sacramento').first()).toBeVisible();
      await expect(page.locator('text=US').first()).toBeVisible();

      // Verify Owner / Contact section
      await expect(page.locator('text=Owner / Contact').first()).toBeVisible();
      await expect(page.locator('text=Jessica Foust').first()).toBeVisible();

      // Verify Call Now button exists (if phone is present)
      await expect(page.locator('text=Call Now').first()).toBeVisible();

      // Verify Visit Website button exists (if website is present)
      await expect(page.locator('text=Visit Website').first()).toBeVisible();

      // Verify Update section with status and assignment
      await expect(page.locator('text=Update').first()).toBeVisible();
      await expect(page.locator('text=Save Changes').first()).toBeVisible();

      // Verify LinkedIn URL is shown in owner section
      await expect(page.locator('text=linkedin.com/in/chefjessrd').first()).toBeVisible();

      await page.screenshot({ path: '/tmp/lead-detail-sections.png', fullPage: true });
      console.log('All lead detail page sections verified');
    });

    test('should show Google Maps link for leads with place_id', async ({ page }) => {
      const testInfo = test.info();
      testInfo.setTimeout(60000);

      await page.goto('/dashboard');
      await page.waitForTimeout(3000);
      await page.locator('input[placeholder*="Search"]').fill('Starbucks');
      await page.waitForTimeout(2000);
      await page.locator('text=Starbucks Coffee Company').first().click();
      await page.waitForURL('**/dashboard/leads/**', { timeout: 10000 });
      await page.waitForTimeout(2000);

      // Verify Google Maps link is present
      await expect(page.locator('text=Google Maps').first()).toBeVisible();
      const mapsLink = page.locator('a[href*="google.com/maps"]').first();
      await expect(mapsLink).toBeVisible();
      await expect(mapsLink).toHaveAttribute('href', /place_id:/);

      console.log('Google Maps link verified with place_id');
    });
  });
});
