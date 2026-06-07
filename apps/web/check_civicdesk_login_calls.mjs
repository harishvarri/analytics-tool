import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Intercept events requests
  await page.route('**/api/v1/events', async (route) => {
    const postData = route.request().postData();
    console.log("\n>>> Intercepted Event Payload:", postData);
    await route.continue();
  });

  try {
    console.log("Navigating to CivicDesk login...");
    await page.goto("https://final-project-v1-nine.vercel.app/login", { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    console.log("Submitting credentials...");
    await page.fill('input[type="email"]', 'harishvarri0@gmail.com');
    await page.fill('input[type="password"]', '123456789');
    
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle' })
    ]);

    console.log("Successfully logged in. Waiting a few seconds...");
    await page.waitForTimeout(4000);

  } catch (error) {
    console.error("Error during intercept:", error);
  } finally {
    await browser.close();
  }
}

run();
