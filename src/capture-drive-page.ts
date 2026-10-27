import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import puppeteer, { type Page } from "puppeteer-core";
import { DRIVE_URL } from "./env.ts";
import { parseSelection } from "./selection.ts";

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

async function waitForPageImage(page: Page, pageNumber: number) {
  return page.waitForFunction(
    (number) => {
      const heading = [...document.querySelectorAll("h2")].find((element) =>
        new RegExp(`^(?:Halaman|Page)\\s+${number}\\s+(?:dari|of)\\s+`).test(
          element.textContent.trim(),
        ),
      );
      const image = heading?.parentElement?.parentElement?.querySelector("img");
      return image?.complete && image.naturalWidth > 0 ? image : false;
    },
    { timeout: 90_000 },
    pageNumber,
  );
}

async function navigateToPage(page: Page, pageNumber: number): Promise<void> {
  const input = await page.$('input[inputmode="numeric"]');
  if (input === null) throw new Error("Drive page number input is missing");
  await input.click();
  await input.evaluate((element) => {
    if (element instanceof HTMLInputElement) element.select();
  });
  await input.type(String(pageNumber));
  await input.press("Enter");
}

async function main(): Promise<void> {
  const selection = parseSelection(process.argv.slice(2));
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    defaultViewport: { width: 1280, height: 1500, deviceScaleFactor: 2 },
  });

  try {
    const page = await browser.newPage();
    await page.goto(DRIVE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForFunction(
      () =>
        /(?:dari|of)\s+[1-9]\d*$/.test(
          document
            .querySelector('input[inputmode="numeric"]')
            ?.getAttribute("aria-label") ?? "",
        ),
      { timeout: 90_000 },
    );
    const total = await page.$eval('input[inputmode="numeric"]', (input) =>
      Number(input.getAttribute("aria-label")?.match(/(\d+)\s*$/)?.[1]),
    );
    if (!Number.isSafeInteger(total) || total < 1) {
      throw new Error("Could not read the Drive page count");
    }
    const end = selection.end ?? total;
    if (end > total) throw new Error(`Choose a page within 1-${total}`);

    // Drive ignores page jumps until the first page finishes rendering.
    const firstImage = await waitForPageImage(page, 1);
    await firstImage.dispose();

    await mkdir(OUTPUT_DIR, { recursive: true });
    const pdf = await PDFDocument.create();
    for (let number = selection.start; number <= end; number += 1) {
      if (number !== 1) await navigateToPage(page, number);
      const handle = await waitForPageImage(page, number);
      const image = handle.asElement();
      if (image === null) throw new Error(`Page ${number} image is missing`);
      const screenshot = await image.screenshot({
        type: "jpeg",
        quality: 95,
        path: join(OUTPUT_DIR, `page-${number}.jpg`),
      });
      await handle.dispose();

      const jpg = await pdf.embedJpg(screenshot);
      const pdfPage = pdf.addPage([jpg.width * 0.375, jpg.height * 0.375]);
      pdfPage.drawImage(jpg, {
        x: 0,
        y: 0,
        width: pdfPage.getWidth(),
        height: pdfPage.getHeight(),
      });
      console.log(`Captured page ${number} of ${total}`);
    }

    const filename =
      selection.start === end
        ? `page-${end}.pdf`
        : `pages-${selection.start}-${end}.pdf`;
    const output = join(OUTPUT_DIR, filename);
    await writeFile(output, await pdf.save());
    console.log(`Saved ${output}`);
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
