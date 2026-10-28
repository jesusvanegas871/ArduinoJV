from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1400, "height": 1100})
    page.goto("http://localhost:5173")
    time.sleep(2)

    # Click on Logistics tab
    page.locator("button:has-text('Optimización Logística')").click()
    time.sleep(1)

    # Click on Picking Inteligente tab
    page.locator("button:has-text('Picking Inteligente')").click()
    time.sleep(1)

    # Click Iniciar Recorrido AGV button
    page.locator("button:has-text('Iniciar Recorrido AGV')").first.click()
    time.sleep(3)

    page.screenshot(path="agv_simulation.png", full_page=True)
    browser.close()
print("Screenshot agv_simulation.png captured successfully!")
