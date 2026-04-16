const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });

  await page.goto('http://localhost:3000');
  await page.evaluate(async () => {
    await fetch('/api/auth/bypass', { method: 'POST' });
  });

  // Navigate directly to the route the user was working on
  await page.goto('http://localhost:3000/#/documents');
  await new Promise(r => setTimeout(r, 2000));
  
  await browser.close();
})();
