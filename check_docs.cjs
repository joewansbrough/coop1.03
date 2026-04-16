const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    fs.writeFileSync('react_error.log', err.toString());
  });

  await page.goto('http://localhost:3000');
  await page.evaluate(async () => {
    await fetch('/api/auth/bypass', { method: 'POST' });
  });

  await page.goto('http://localhost:3000/#/documents');
  
  await new Promise(r => setTimeout(r, 2000));
  fs.writeFileSync('dump_docs.html', await page.content());
  await browser.close();
})();
