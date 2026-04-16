const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  // Login first bypass
  console.log('Logging in...');
  await page.goto('http://localhost:3000/api/auth/bypass', { method: 'POST' });
  await page.evaluate(async () => {
    await fetch('/api/auth/bypass', { method: 'POST' });
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000');
  
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
