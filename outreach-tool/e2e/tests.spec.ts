import { test, expect } from '@playwright/test';

async function loginAsync({ page }: { page: import('@playwright/test').Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 10000 });
}

test.describe('Vexabots Outreach Tool - E2E Tests', () => {
  // ==================== LOGIN PAGE ====================
  test.describe('Login Page', () => {
    test('should load with correct title', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveTitle(/Vexabots/);
    });

    test('should show email and password fields', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
    });

    test('should show Sign In button', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    });

    test('should show magic link section', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('#magic-email')).toBeVisible();
      await expect(page.getByRole('button', { name: /Send Magic Link/i })).toBeVisible();
    });

    test('should show Vexabots branding', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Vexabots/i })).toBeVisible();
      await expect(page.getByText('Outreach Tool')).toBeVisible();
    });

    test('should show error on wrong password', async ({ page }) => {
      await page.goto('/');
      await page.locator('#email').fill('asad@vexabots.com');
      await page.locator('#password').fill('wrongpassword');
      await page.getByRole('button', { name: /Sign In/i }).click();
      await expect(page.locator('text=Invalid login credentials')).toBeVisible({ timeout: 10000 });
    });
  });

  // ==================== AUTH GUARD ====================
  test.describe('Auth Guard', () => {
    test('should redirect unauthenticated user to login', async ({ page }) => {
      await page.goto('/dashboard');
      await page.waitForURL('**/');
      await expect(page).toHaveTitle(/Vexabots/);
    });
  });

  // ==================== SIDEBAR NAVIGATION ====================
  test.describe('Sidebar Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsync({ page });
    });

    test('should show 4 nav items', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Leads', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Add Lead' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Import CSV' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    });

    test('should highlight Leads on dashboard home', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Leads', exact: true })).toHaveClass(/bg-blue-600/);
      await expect(page.getByRole('link', { name: 'Add Lead' })).not.toHaveClass(/bg-blue-600/);
    });

    test('should highlight Add Lead on new lead page', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.getByRole('link', { name: 'Add Lead' })).toHaveClass(/bg-blue-600/);
      await expect(page.getByRole('link', { name: 'Leads', exact: true })).not.toHaveClass(/bg-blue-600/);
    });

    test('should highlight Import CSV on import page', async ({ page }) => {
      await page.goto('/dashboard/import');
      await expect(page.getByRole('link', { name: 'Import CSV' })).toHaveClass(/bg-blue-600/);
    });
  });

  // ==================== LEADS DASHBOARD ====================
  test.describe('Leads Dashboard', () => {
    // Runs sequentially to avoid shared state conflicts between tests
    test.describe.configure({ mode: 'parallel' });

    test.beforeEach(async ({ page }) => {
      await loginAsync({ page });
    });

    test('should load with heading', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: 'Leads' })).toBeVisible();
      await expect(page.getByText('total leads')).toBeVisible({ timeout: 10000 });
    });

    test('should have search input and filter dropdowns', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.locator('input[placeholder="Search by name, company, phone..."]')).toBeVisible();
      // DOM text is "Status" but CSS transforms to uppercase - check for the lowercase DOM text
      await expect(page.locator('label:has-text("Status")')).toBeVisible();
      await expect(page.locator('label:has-text("Source")')).toBeVisible();
      await expect(page.locator('label:has-text("Sort")')).toBeVisible();
    });

    test('should have refresh button', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('button', { name: /Refresh/i })).toBeVisible();
    });

    test('should navigate to Add Lead via sidebar', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Add Lead' }).click();
      await expect(page).toHaveURL('/dashboard/leads/new');
    });

    test('should navigate to Import CSV via sidebar', async ({ page }) => {
      await page.goto('/dashboard');
      await page.getByRole('link', { name: 'Import CSV' }).click();
      await expect(page).toHaveURL('/dashboard/import');
    });
  });

  // ==================== ADD LEAD PAGE ====================
  test.describe('Add Lead Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsync({ page });
    });

    test('should load form with all sections', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.getByRole('heading', { name: 'Add Lead' })).toBeVisible();
      await expect(page.getByText('Manually add a business')).toBeVisible();
      await expect(page.getByText('Owner / Contact Person')).toBeVisible();
      await expect(page.getByText('Additional')).toBeVisible();
    });

    test('should have business fields', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.locator('input[name="title"]')).toBeVisible();
      await expect(page.locator('select[name="source"]')).toBeVisible();
      await expect(page.locator('input[name="phone"]')).toBeVisible();
      await expect(page.locator('input[name="website"]')).toBeVisible();
      await expect(page.locator('input[name="city"]')).toBeVisible();
      await expect(page.locator('input[name="country_code"]')).toBeVisible();
    });

    test('should have owner section fields', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.locator('input[name="owner_name"]')).toBeVisible();
      await expect(page.locator('input[name="owner_role"]')).toBeVisible();
      await expect(page.locator('input[name="owner_linkedin_url"]')).toBeVisible();
      await expect(page.locator('select[name="company_size_estimate"]')).toBeVisible();
    });

    test('should have additional fields', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.locator('input[name="place_id"]')).toBeVisible();
      await expect(page.locator('textarea[name="notes"]')).toBeVisible();
    });

    test('should have Add and Cancel buttons', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await expect(page.getByRole('button', { name: /Add Lead/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
    });

    test('should redirect to dashboard on Cancel', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await page.getByRole('button', { name: /Cancel/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    test('should submit valid form', async ({ page }) => {
      await page.goto('/dashboard/leads/new');
      await page.locator('input[name="title"]').fill('Test Construction Co');
      await page.locator('select[name="source"]').selectOption('manual');
      await page.locator('input[name="phone"]').fill('+923001234567');
      await page.locator('input[name="website"]').fill('https://test.com');
      await page.locator('input[name="city"]').fill('Lahore');
      await page.locator('input[name="country_code"]').fill('PK');
      await page.locator('input[name="owner_name"]').fill('Test Owner');
      await page.locator('input[name="owner_role"]').fill('Owner');
      await page.locator('select[name="company_size_estimate"]').selectOption('small');
      await page.locator('input[name="place_id"]').fill('ChIJ123');
      await page.locator('textarea[name="notes"]').fill('Test note');

      await page.getByRole('button', { name: /Add Lead/i }).click();
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  // ==================== IMPORT CSV PAGE ====================
  test.describe('Import CSV Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginAsync({ page });
    });

    test('should load with heading', async ({ page }) => {
      await page.goto('/dashboard/import');
      await expect(page.getByRole('heading', { name: 'Import CSV' })).toBeVisible();
      await expect(page.getByText('Upload a CSV file and map its columns to lead fields')).toBeVisible();
    });

    test('should show file upload area', async ({ page }) => {
      await page.goto('/dashboard/import');
      await expect(page.getByText('Click to upload')).toBeVisible();
      await expect(page.getByText('drag and drop')).toBeVisible();
      await expect(page.getByText('CSV file, max 5MB')).toBeVisible();
    });

    test('should show column mapping after CSV upload', async ({ page }) => {
      await page.goto('/dashboard/import');
      const csvContent = 'Business Name,Website,Phone,City,Notes\nTest Co,https://test.com,+923001234567,Lahore,Test note';
      await page.locator('input[type="file"]').setInputFiles({
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      });
      await expect(page.getByRole('heading', { name: 'Map Columns' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('Preview (first 1 rows)')).toBeVisible({ timeout: 10000 });
    });

    test('should show Import button after file upload', async ({ page }) => {
      await page.goto('/dashboard/import');
      const csvContent = 'Business Name\nTest Co';
      await page.locator('input[type="file"]').setInputFiles({
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      });
      await expect(page.getByRole('button', { name: /Import/i })).toBeVisible({ timeout: 10000 });
    });

    test('should have source selector after file upload', async ({ page }) => {
      await page.goto('/dashboard/import');
      const csvContent = 'Business Name\nTest Co';
      await page.locator('input[type="file"]').setInputFiles({
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(csvContent),
      });
      await expect(page.getByText('Default Source for imported leads')).toBeVisible({ timeout: 10000 });
    });
  });
});
