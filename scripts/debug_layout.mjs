import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Navigate to the local server
    await page.goto('http://localhost:3000/');

    // Wait for React to render (carousel should appear)
    await page.waitForSelector('text=CONSULTAR TICKETS', { timeout: 10000 });

    // Take a full page screenshot
    await page.screenshot({ path: 'local_debug_screenshot.png', fullPage: true });

    // Evaluate the bounding box and computed styles of the affected elements
    const info = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('a')).find(a => a.textContent && a.textContent.includes('CONSULTAR TICKETS'));
        const bar = document.querySelector('.bg-\\[\\#0066FF\\]') || btn;

        if (!btn) return 'Button not found';

        const rect = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);

        return {
            text: btn.textContent,
            rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
            position: style.position,
            transform: style.transform,
            parentPosition: window.getComputedStyle(btn.parentElement).position,
            grandParentPosition: window.getComputedStyle(btn.parentElement.parentElement).position
        };
    });

    console.log('DOM Info:', info);

    await browser.close();
})();
