from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1280, "height": 960})
    page.goto("http://localhost:5173")
    time.sleep(2)

    # Click on Logistics tab button
    page.locator("button:has-text('Optimización Logística')").click()
    time.sleep(1)

    # Click on Picking Inteligente tab
    page.locator("button:has-text('Picking Inteligente')").click()
    time.sleep(1)

    # Click Generar Lista de Despacho Ordenada
    page.locator("button:has-text('Generar Lista de Despacho Ordenada')").click()
    time.sleep(1)

    page.screenshot(path="picking_ui.png", full_page=True)
    browser.close()
print("Screenshot taken!")
