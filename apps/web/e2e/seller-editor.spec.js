import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const { build } = createRequire(import.meta.resolve("wrangler/package.json"))("esbuild");

// Isolated browser fixture: real route component and validator, no hosted auth or writes.
let script;
let styles;
test.beforeAll(async () => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "jsx", contents: `
      import { createRoot } from 'react-dom/client';
      import { createMemoryRouter, RouterProvider } from 'react-router';
      import SellerProducts from './app/routes/seller-products.jsx';
      import { validateSellerProduct } from './app/lib/seller-catalog.server.js';
      const router = createMemoryRouter([{
        path: '/:locale/seller/products', Component: SellerProducts,
        loader: () => window.fixture,
        action: async ({ request }) => {
          const fields = Object.fromEntries(await request.formData());
          window.submitted = fields;
          if (fields.intent === 'adjust-stock') return { stockSuccess: true, variantId: fields.variant_id, adjustmentId: fields.adjustment_id };
          const product = validateSellerProduct(fields);
          if (!product || product.variants.some(v => !v.variant_id)) return { error: 'invalid' };
          if (window.failSave) return { error: 'failed' };
          return { updated: fields.product_id };
        }
      }], { initialEntries: ['/' + window.fixture.locale + '/seller/products'] });
      createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  script = bundle.outputFiles[0].text;
  styles = (await Promise.all(["app.css", "catalog.css", "showcase.css"].map((name) => readFile(`app/${name}`, "utf8")))).join("\n");
});

async function openEditor(page, { locale = "en", ownerAccess = true, failSave = false } = {}) {
  const shopId = "10000000-0000-4000-8000-000000000001";
  const categoryId = "10000000-0000-4000-8000-000000000002";
  const shop = { shop_id: shopId, shop_slug: "test-shop", name_en: "Test shop", name_ar: "متجر تجريبي" };
  const fixture = {
    locale, state: "ready", shops: [shop], shop, ownerAccess,
    categories: [{ id: categoryId, name_en: "Clothing", name_ar: "ملابس" }], stockAdjustments: [],
    products: [{ product_id: "10000000-0000-4000-8000-000000000003", category_id: categoryId,
      slug: "shirt", title_en: "Cotton shirt", title_ar: "قميص قطني", description_ar: "", description_en: "",
      status: "published", variants: [{ id: "10000000-0000-4000-8000-000000000004", sku: "SHIRT-1",
        price_fils: 12500, supply_mode: "stocked", stock_quantity: 8, option_values: [], adjustment_id: "10000000-0000-4000-8000-000000000005" }] }],
  };
  await page.route("**/__seller-fixture", (route) => route.fulfill({ contentType: "text/html", body: `<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${styles}</style></head><body><div id="root"></div></body></html>` }));
  await page.goto("/__seller-fixture");
  await page.evaluate(({ fixture, failSave }) => { window.fixture = fixture; window.failSave = failSave; }, { fixture, failSave });
  await page.addScriptTag({ content: script });
  await expect(page.locator(".seller-editor")).toBeVisible();
}

test("seller edit submits the existing variant identity and closes on success", async ({ page }, testInfo) => {
  await openEditor(page);
  await page.screenshot({ path: testInfo.outputPath("seller-catalog-fixture.png"), fullPage: true });
  await expect(page.locator('.seller-editor form')).not.toBeVisible();
  await page.getByRole("button", { name: "Edit listing" }).click();
  await expect(page.locator('[name="title_en"]')).toHaveValue("Cotton shirt");
  await page.locator('[name="title_en"]').fill("Updated cotton shirt");
  await page.getByRole("button", { name: "Save listing changes" }).click();
  await expect(page.getByRole("status")).toContainText("Product updated.");
  expect(JSON.parse(await page.evaluate(() => window.submitted.variants_json))[0].variant_id).toBe("10000000-0000-4000-8000-000000000004");
  await expect(page.locator('.seller-editor form')).not.toBeVisible();
});

test("seller edit preserves entered text after failure and staff see no owner controls", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page, { ownerAccess: false, failSave: true });
  await expect(page.locator('a[href$="/seller/staff"], a[href$="/seller/shop"], a[href$="/seller/delivery"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Edit listing" }).click();
  await page.locator('[name="title_en"]').fill("Keep this edit");
  await page.getByRole("button", { name: "Save listing changes" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.locator('[name="title_en"]')).toHaveValue("Keep this edit");
  await page.getByRole("button", { name: "Cancel editing" }).click();
  await page.getByRole("button", { name: "Edit listing" }).click();
  await expect(page.locator('[name="title_en"]')).toHaveValue("Cotton shirt");
});

test("seller catalog fixture is usable in Arabic on a narrow screen", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await openEditor(page, { locale: "ar" });
  await expect(page.locator('.portal-nav a[href$="/seller/shop"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("seller-ar-fixture.png"), fullPage: true });
  await page.getByRole("button", { name: "تعديل المنتج" }).click();
  await expect(page.locator('[name="title_ar"]')).toHaveValue("قميص قطني");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("seller-editor-ar-fixture.png"), fullPage: true });
});

test("stock adjustment clears the completed change so it cannot be reapplied accidentally", async ({ page }) => {
  await openEditor(page);
  await page.locator(".seller-stock > summary").click();
  await page.locator('[name="delta"]').fill("2");
  await page.locator('[name="reason"]').fill("Delivery received");
  await page.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Stock updated.");
  await expect(page.locator('[name="delta"]')).toHaveValue("");
  await expect(page.locator('[name="reason"]')).toHaveValue("");
});
