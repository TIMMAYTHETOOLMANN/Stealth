import { test, expect } from '@playwright/test';

test('End-to-end functionality verification for Portland Oregon Engineering Technician', async ({ page }) => {
  // Increase timeout for generating docs
  test.setTimeout(120000);

  await page.goto('http://localhost:3000/');
  
  // Wait for loading to finish
  await page.waitForSelector('.auth-card', { state: 'visible', timeout: 10000 });
  
  // Register Account
  await page.click('button:has-text("Create Account")');
  await page.fill('label:has-text("Operator Email") + input', `testuser_${Date.now()}@example.com`);
  await page.fill('label:has-text("Passphrase") + input', 'password123');
  await page.click('button:has-text("Initialize Operator")');
  
  // Wait for Dashboard to load (look for Sign Out button or Dashboard tabs)
  await page.waitForSelector('button:has-text("Sign Out")', { state: 'visible', timeout: 10000 });
  
  // Fill Master Profile
  await page.click('button:has-text("Master Profile")');
  await page.fill('label:has-text("Full Name") + input', 'John Doe');
  await page.fill('label:has-text("Headline") + input', 'Experienced Engineering Technician');
  await page.fill('label:has-text("Professional Summary") + textarea', 'I am an experienced engineering technician with strong background in debugging and testing.');
  
  // Add skills (crucial to pass validation for generating application)
  await page.fill('input[placeholder="Add a skill and press Enter"]', 'Engineering');
  await page.keyboard.press('Enter');
  await page.fill('input[placeholder="Add a skill and press Enter"]', 'Testing');
  await page.keyboard.press('Enter');
  
  // Add experience
  await page.click('text=+ Role');
  await page.fill('label:has-text("Title") + input', 'Engineering Technician');
  await page.fill('label:has-text("Company") + input', 'Test Corp');
  await page.fill('textarea[placeholder="Quantified, real accomplishment."]', 'Worked as a technician for 5 years, tested and debugged systems.');
  
  await page.click('button:has-text("Save Master Profile")');
  await expect(page.locator('text=Master profile saved.')).toBeVisible();
  
  // Go to Targets -> Paste a description for Portland Oregon
  // First match targets since they have the count span inside
  const tabs = page.locator('.tab');
  await tabs.filter({ hasText: 'Targets' }).click();
  
  await page.click('button:has-text("Paste")');
  
  const jobText = `
    Job Title: Engineering Technician
    Location: Portland, Oregon
    Requirements:
    - 3+ years experience as a technician
    - Familiar with testing and debugging
    - BS in Engineering
    - Portland Oregon engineering technician roles
  `;
  await page.fill('label:has-text("Job Description") + textarea', jobText);
  await page.fill('label:has-text("Title override (optional)") + input', 'Engineering Technician');
  await page.fill('label:has-text("Company override (optional)") + input', 'Portland Engineering Corp');
  await page.click('button:has-text("Save Job")');
  
  await expect(page.locator('text=Job saved from pasted text.')).toBeVisible();
  
  // Wait for the Tailor & Apply button to be active
  await page.waitForSelector('button:has-text("Tailor & Apply")');
  
  // We use Promise.all to ensure we catch the response
  const [response] = await Promise.all([
    page.waitForResponse(res => res.url().includes('/api/applications') && res.request().method() === 'POST'),
    page.click('button:has-text("Tailor & Apply")')
  ]);
  
  expect(response.ok()).toBeTruthy();
  
  // Wait for either success or error
  const successLoc = page.locator('text=Tailored application generated. Open the Applications tab.');
  
  await Promise.race([
    successLoc.waitFor({ state: 'visible', timeout: 30000 }),
    page.waitForSelector('.alert', { state: 'visible', timeout: 30000 }).then(async () => {
      const text = await page.locator('.alert').textContent();
      if (!text?.includes('Tailored application generated')) {
        throw new Error(`Failed with alert: ${text}`);
      }
    })
  ]);
  
  // Go to applications tab
  await tabs.filter({ hasText: 'Applications' }).click();
  
  await expect(page.locator('h3:has-text("Engineering Technician")')).toBeVisible();
  await expect(page.locator('text=Portland Engineering Corp')).toBeVisible();
});
