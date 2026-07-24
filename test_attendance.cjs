const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.failure().errorText, request.url()));

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  
  // Click on the Attendance tab
  const attTab = await page.$('.sidebar-nav-item:nth-child(5)'); // Assuming 5th is attendance or we can navigate directly
  // Wait, React router might not be set up, so we can just click the tab by text
  const tabs = await page.$$('.sidebar-nav-item');
  for (let tab of tabs) {
    const text = await page.evaluate(el => el.textContent, tab);
    if (text.includes('حاضری')) {
      await tab.click();
      break;
    }
  }
  
  await page.waitForTimeout(1000);
  console.log("On Attendance Tab");

  // Find a select dropdown
  const selects = await page.$$('select');
  console.log("Found dropdowns:", selects.length);
  if (selects.length > 0) {
      await selects[0].select('cls-1');
      console.log("Selected cls-1 on the first dropdown");
  }
  
  await page.waitForTimeout(1000);
  
  const html = await page.content();
  if (html.includes('id="root"')) {
      const rootContent = await page.$eval('#root', el => el.innerHTML);
      console.log("Root content length after interaction:", rootContent.length);
      if (rootContent.length === 0) {
          console.log("SCREEN IS BLANK!");
      }
  }

  await browser.close();
})();
