import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})

        # Load main app
        await page.goto("http://localhost:3000")
        await page.wait_for_timeout(3000)

        # Click Optimización Logística header button
        await page.get_by_role("button", name="Optimización Logística").click()
        await page.wait_for_timeout(2000)

        # Take screenshot of Task 5 - Distribution Routes
        await page.screenshot(path="routes_ui.png", full_page=True)
        print("Captured routes_ui.png")

        # Click Picking Inteligente sub-tab
        await page.get_by_role("button", name="Picking Inteligente (Tarea 6)").click()
        await page.wait_for_timeout(2000)

        # Take screenshot of Task 6 - Smart Picking Layout
        await page.screenshot(path="picking_ui.png", full_page=True)
        print("Captured picking_ui.png")

        await browser.close()

asyncio.run(main())
