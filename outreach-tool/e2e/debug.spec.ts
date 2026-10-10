import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function loginAsync({ page }: { page: Page }) {
  await page.goto('/');
  await page.locator('#email').fill('asad@vexabots.com');
  await page.locator('#password').fill('test1234');
  await page.getByRole('button', { name: /Sign In/i }).click();
  await page.waitForURL('**/dashboard**', { timeout: 15000 });
}

test.describe('Phase 3 E2E - Activity Log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsync({ page });
  });

  test('should find and view activity log on lead detail page', async ({ page }) => {
    // Go to dashboard and find an existing lead
    await page.goto('/dashboard');
    await page.waitForTimeout(3000);
    
    // Get all lead links
    const leadLinks = await page.$$('a[href*="/dashboard/leads/"]');
    console.log('Found lead links:', leadLinks.length);
    
    if (leadLinks.length > 0) {
      // Click first lead
      const firstUrl = await leadLinks[0].getAttribute('href');
      console.log('First lead URL:', firstUrl);
      
      await leadLinks[0].click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      // Check URL
      console.log('Current URL:', page.url());
      
      // Check page content
      const pageContent = await page.content();
      console.log('Page contains "activity":', pageContent.toLowerCase().includes('activity'));
      console.log('Page contains "Activity Log":', pageContent.includes('Activity Log'));
      
      // Screenshot
      await page.screenshot({ path: '/tmp/lead-detail-debug.png', fullPage: true });
      
      // Try different selectors
      const hasH2ActivityLog = await page.locator('h2').filter({ hasText: /Activity Log/i }).isVisible();
      const hasAnyActivityText = await page.locator('text=/[Aa]ctivity/i').first().isVisible();
      const hasLogActivityBtn = await page.locator('text=/Log Activity/i').first().isVisible();
      
      console.log('hasH2ActivityLog:', hasH2ActivityLog);
      console.log('hasAnyActivityText:', hasAnyActivityText);
      console.log('hasLogActivityBtn:', hasLogActivityBtn);
    }
  });
});
