from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Click on Inventory tab
    page.get_by_text("Maestro de Inventario").click()
    page.wait_for_timeout(1000)

    # Filter by Class A
    page.get_by_role("combobox").first.select_option("A")
    page.wait_for_timeout(1000)

    # Switch to Weekly Cycle Count tab
    page.get_by_text("Conteo Cíclico Semanal").click()
    page.wait_for_timeout(1000)

    # Click Generate Week 1 button
    page.get_by_role("button", name="Generar Semana Aleatoria").click()
    page.wait_for_timeout(1500)

    # Click Simulate Year button
    page.get_by_role("button", name="Simular Año Completo").click()
    page.wait_for_timeout(2000)

    # Screenshot the resulting state
    page.screenshot(path="/home/jules/verification/screenshots/wms_cycle_counting.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
