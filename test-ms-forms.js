const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://forms.cloud.microsoft/pages/responsepage.aspx?id=8_JzqsvIhkuIizsiUf6MkbJMrahquPFMqgBrur5UadNUN0ROTDU5Q1owMlJRS0VJUzk4R1VZNlZFMy4u&route=shorturl', {waitUntil: 'networkidle2'});
  const html = await page.evaluate(() => {
    const radioInputs = document.querySelectorAll('input[type="radio"]');
    if(radioInputs.length > 0) {
      let current = radioInputs[0];
      let hierarchy = [];
      for(let i=0; i<8; i++) {
        hierarchy.push(current.tagName + ' (role=' + current.getAttribute('role') + ', class=' + current.className + ', name=' + current.name + ', aria-labelledby=' + current.getAttribute('aria-labelledby') + ')');
        current = current.parentElement;
        if(!current) break;
      }
      return hierarchy.join('\n^ ');
    }
    return 'No radio inputs found';
  });
  console.log('Hierarchy:\n' + html);
  await browser.close();
})();
