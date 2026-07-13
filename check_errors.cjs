const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request =>
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText)
  );

  console.log('Navigating to preview server...');
  await page.goto('http://localhost:4173/jewell-bill-mvp/', { waitUntil: 'networkidle2' });
  
  console.log('Page loaded. Taking screenshot...');
  await page.screenshot({ path: 'C:/Users/ASUS/Dropbox/PC/Desktop/TRIAL SNJ BILLING/screenshot.png' });
  
  await browser.close();
  console.log('Done.');
})();
