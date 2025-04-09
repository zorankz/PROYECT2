import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import anticaptcha from '@antiadmin/anticaptchaofficial';

puppeteer.use(StealthPlugin());
anticaptcha.setAPIKey('a8a0f3e560b3d9e2ffcae00e8f976d55');

const siteURL = 'https://acis.eoir.justice.gov/en/';

export default async function consultarEOIR(alienNumber) {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  try {
    console.log('🌐 Accediendo al sitio EOIR...');
    await page.goto(siteURL, { waitUntil: 'networkidle2' });

    try {
      await page.waitForSelector('.ReactModal__Overlay .btn', { timeout: 10000 });
      const btn = await page.$('.ReactModal__Overlay .btn');
      if (btn) await btn.click();
    } catch {}

    const digits = alienNumber.replace(/[^0-9]/g, '');
    if (digits.length !== 9) throw new Error('Número A inválido');

    await page.waitForSelector('.codeInput input');
    const input = await page.$('.codeInput input');
    await input.click({ clickCount: 3 });
    await page.keyboard.type(digits, { delay: 100 });
    await page.click('#btn_submit');
    await page.waitForTimeout(3000);

    const captchaPendiente = await page.evaluate(() => {
      return document.querySelector('iframe[src*="sitekey="]') !== null;
    });

    if (captchaPendiente) {
      const iframeSrc = await page.$eval('iframe[src*="sitekey="]', el => el.getAttribute('src'));
      const sitekey = iframeSrc.match(/sitekey=([a-z0-9\-]+)/)?.[1];
      const token = await anticaptcha.solveHCaptchaProxyless(siteURL, sitekey);

      await page.evaluate(token => {
        const textarea = document.createElement('textarea');
        textarea.name = 'h-captcha-response';
        textarea.style.display = 'block';
        textarea.value = token;
        document.body.appendChild(textarea);
      }, token);

      try {
        await page.click('#btn_submit');
      } catch {}
    }

    await page.waitForFunction(() => {
      const txt = document.body.innerText;
      return txt.includes('Next Hearing') || txt.includes('Court Contact Information') || txt.includes('case was not found');
    }, { timeout: 30000 });

    const noCase = await page.evaluate(() => {
      return document.body.innerText.includes('case was not found');
    });

    if (noCase) {
      await browser.close();
      return { error: 'No se encontró ningún caso para este número A' };
    }

    const datos = await page.evaluate(() => {
      const get = (sel) => document.querySelector(sel)?.innerText?.trim() || null;

      const nombre = get('div.flex.flex-wrap.font-bold > div:nth-child(2)');
      const numeroA = get('div.flex.flex-wrap.font-bold > div:nth-child(5)');

      const direccionParteServida = (() => {
        try {
          const section = Array.from(document.querySelectorAll('section'))
            .find(s => s.innerText.includes('Court Contact Information'));
          
          if (!section) return 'No encontrada';

          const spans = section.querySelectorAll('span');
          const line1 = spans[0]?.innerText?.trim() || '';
          const line2 = spans[1]?.innerText?.trim() || '';
          return `${line1} ${line2}`.trim();
        } catch (e) {
          return 'No encontrada';
        }
      })();

      return {
        numeroA,
        nombre,
        nombreFirmante: nombre,
        parteServida: 'IMMIGRATION COURT',
        direccionParteServida,
        metodoServicio: 'FIRST MAIL CLASS DELIVERY',
        fecha: new Date().toLocaleDateString('en-GB') // dd/mm/yyyy
      };
    });

    await browser.close();
    return datos;

  } catch (err) {
    console.error('❌ Error durante scraping:', err.message);
    await page.screenshot({ path: 'error_screenshot.png', fullPage: true });
    await browser.close();
    return { error: 'Fallo consultando EOIR', detalle: err.message };
  }
}
