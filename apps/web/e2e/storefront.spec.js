import { expect, test } from "@playwright/test";

test("English and Arabic catalog routes set the correct reading direction", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("searchbox", { name: "Search products or shops" })).toBeVisible();

  await page.goto("/ar");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveAttribute("placeholder", "\u0627\u0628\u062d\u062b \u0639\u0646 \u0645\u0646\u062a\u062c \u0623\u0648 \u0645\u062a\u062c\u0631");
});

test("sample storefront puts products in the first desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/en?showcase=1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.locator(".product-card").first()).toBeVisible();
  expect((await page.locator(".product-card").first().boundingBox()).y).toBeLessThan(900);
});

test("signed-out platform overview does not stretch its message card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/ar/admin");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect((await page.locator(".platform-overview").boundingBox()).height).toBeLessThan(400);
});

test("search-as-you-type updates the shareable URL after its debounce", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("searchbox", { name: "Search products or shops" }).fill("linen");
  await expect(page).toHaveURL(/\/en\?q=linen$/, { timeout: 5_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("linen");
});

test("unconfigured and filtered catalog pages are excluded from indexing", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);

  await page.goto("/en?q=linen");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");

  await page.goto("/en/p/shop/item");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
});

test("not-found recovery uses the requested locale and offers language switching", async ({ page }) => {
  for (const [locale, direction, heading, home, language] of [
    ["en", "ltr", "Page not found", "Back to shopping", "\u0627\u0644\u0639\u0631\u0628\u064a\u0629"],
    ["ar", "rtl", "\u0627\u0644\u0635\u0641\u062d\u0629 \u063a\u064a\u0631 \u0645\u0648\u062c\u0648\u062f\u0629", "\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u062a\u0633\u0648\u0642", "EN"],
  ]) {
    const response = await page.goto(`/${locale}/missing-page`);
    expect(response.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: home })).toHaveAttribute("href", `/${locale}`);
    await expect(page.getByRole("link", { name: language })).toHaveAttribute("href", `/${locale === "ar" ? "en" : "ar"}`);
  }
});

test("workspace URLs with an unsupported locale return 404", async ({ page }) => {
  for (const path of ["/fr/seller", "/fr/admin", "/fr/owner/admins", "/fr/owner/delivery"]) {
    const response = await page.goto(path);
    expect(response.status(), path).toBe(404);
  }
});

test("shop pages return an explicit unconfigured state and stay out of search indexes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/s/example-shop`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(locale === "ar" ? "\u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u062a\u062c\u0631 \u0642\u064a\u062f \u0627\u0644\u0625\u0639\u062f\u0627\u062f" : "setup in progress");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("seller and owner routes have private, explicit sign-in states", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/en/seller", "/en/seller/apply", "/en/seller/staff", "/en/seller/products", "/en/seller/delivery", "/en/admin/sellers", "/en/admin/categories", "/en/owner/admins", "/en/owner/delivery", "/en/account/mfa"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,nofollow");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/en/seller/apply");
  await expect(page.getByRole("link", { name: "Sign in to apply" })).toBeVisible();
  await page.goto("/en/seller");
  await expect(page.getByText("Sign in to open your seller workspace.")).toBeVisible();
  await page.goto("/en/seller/staff");
  await expect(page.getByText("Sign in to manage your shop staff.")).toBeVisible();
  await page.goto("/en/seller/products");
  await expect(page.getByText("Sign in to manage your seller catalog.")).toBeVisible();
  await page.goto("/en/owner/admins");
  await expect(page.getByText("Sign in as the platform owner.")).toBeVisible();
  await page.goto("/en/seller/delivery");
  await expect(page.getByText("Sign in to manage shop delivery.")).toBeVisible();
  await page.goto("/en/owner/delivery");
  await expect(page.getByText("Sign in with the platform owner account.")).toBeVisible();
});

test("English and Arabic storefronts do not overflow at supported viewport widths", async ({ page }) => {
  for (const width of [320, 375, 390, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 768 ? 800 : 1000 });
    for (const locale of ["en", "ar"]) {
      await page.goto(`/${locale}`);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        offenders: [...document.querySelectorAll("body *")]
          .map((element) => ({ element, bounds: element.getBoundingClientRect() }))
          .filter(({ bounds }) => bounds.right > window.innerWidth || bounds.left < 0)
          .slice(0, 8)
          .map(({ element, bounds }) => `${element.tagName.toLowerCase()}.${element.className?.baseVal ?? element.className} left=${Math.round(bounds.left)} right=${Math.round(bounds.right)}`),
      }));
      expect(layout.overflow, `${locale} layout overflows at ${width}px: ${layout.offenders.join(", ")}`).toBe(false);
    }
  }
});

test("cart states that checkout is unavailable while its integrations are unconfigured", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bnafsaji-cart-v2", JSON.stringify([{
    product_id: "a0000000-0000-4000-8000-000000000001",
    variant_id: "c0000000-0000-4000-8000-000000000001",
    product_slug: "item",
    shop_slug: "shop",
    title_en: "Item",
    quantity: 1,
  }])));
  await page.goto("/en/cart");
  await expect(page.getByRole("alert")).toContainText("shop service is not configured");
  await expect(page.getByText("Their availability and current prices have not been verified.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Place order|Pay now|Checkout/i })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue shopping" })).toHaveCount(1);
});

test("unconfigured account explains the outage without editable sign-in fields", async ({ page }) => {
  await page.goto("/en/account");
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page.getByRole("textbox", { name: /email/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sign in|create account|reset password/i })).toHaveCount(0);
});

test("guest wishlist persists on this device and refreshes saved product details", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bnafsaji-wishlist-v1", JSON.stringify([
    "a0000000-0000-4000-8000-000000000001",
  ])));
  await page.goto("/en/wishlist");
  await expect(page.getByRole("heading", { level: 1, name: "Your wishlist" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex,follow");
  await expect(page.getByRole("alert")).toContainText("Saved products could not be refreshed");
  await expect(page.getByRole("link", { name: /Wishlist \(1\)/ })).toBeVisible();
});

test("wishlist distinguishes saved IDs no longer returned by the public catalog", async ({ page }) => {
  const available = "a0000000-0000-4000-8000-000000000001";
  const unavailable = "a0000000-0000-4000-8000-000000000002";
  await page.addInitScript((ids) => localStorage.setItem("bnafsaji-wishlist-v1", JSON.stringify(ids)), [available, unavailable]);
  await page.route("**/en/cart/items?ids=**", async (route) => {
    const requestedIds = new URL(route.request().url()).searchParams.get("ids").split(",");
    const products = requestedIds.includes(available) ? [{
      id: available, slug: "shirt", title_en: "Current shirt", price_fils: 12500,
      shops: { slug: "maker", name_en: "Maker" }, images: [],
    }] : [];
    await route.fulfill({ json: { state: "ready", requestedIds, products } });
  });
  await page.goto("/en/wishlist");
  await expect(page.getByRole("heading", { name: "Current shirt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Saved products no longer in the public catalog" })).toBeVisible();
  await expect(page.getByText("This saved product is no longer available in the public catalog.")).toBeVisible();
  await page.getByRole("button", { name: "Remove unavailable saved product 1" }).click();
  await expect(page.getByRole("heading", { name: "Saved products no longer in the public catalog" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Current shirt" })).toBeVisible();
});

test("wishlist does not call an unresolved saved ID an empty list", async ({ page }) => {
  const unavailable = "a0000000-0000-4000-8000-000000000002";
  await page.addInitScript((ids) => localStorage.setItem("bnafsaji-wishlist-v1", JSON.stringify(ids)), [unavailable]);
  await page.route("**/en/cart/items?ids=**", async (route) => {
    const requestedIds = new URL(route.request().url()).searchParams.get("ids").split(",");
    await route.fulfill({ json: { state: "ready", requestedIds, products: [] } });
  });
  await page.goto("/en/wishlist");
  await expect(page.getByRole("heading", { name: "Saved products no longer in the public catalog" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your wishlist is empty" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove unavailable saved product 1" })).toBeVisible();
});

test("wishlist rejects partial catalog refresh responses instead of showing false unavailable items", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("bnafsaji-wishlist-v1", JSON.stringify([
    "a0000000-0000-4000-8000-000000000001",
  ])));
  await page.route("**/en/cart/items?ids=**", async (route) => {
    await route.fulfill({ json: { state: "ready", requestedIds: [], products: [] } });
  });
  await page.goto("/en/wishlist");
  await expect(page.getByRole("alert")).toContainText("Saved products could not be refreshed");
  await expect(page.getByRole("heading", { name: "Saved products no longer in the public catalog" })).toHaveCount(0);
});

test("homepage presents clear shopping and seller entry points in both languages", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const [locale, direction, heading, browse, seller] of [
    ["en", "ltr", "Find something made close to home", "Browse products", "List your shop"],
    ["ar", "rtl", "\u062a\u0633\u0648\u0651\u0642 \u0645\u0646 \u0645\u062a\u0627\u062c\u0631 \u0642\u0631\u064a\u0628\u0629 \u0645\u0646\u0643", "\u062a\u0635\u0641\u0651\u062d \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a", "\u0627\u0639\u0631\u0636 \u0645\u0646\u062a\u062c\u0627\u062a \u0645\u062a\u062c\u0631\u0643"],
  ]) {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("dir", direction);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("link", { name: browse })).toHaveAttribute("href", "#product-results");
    await page.getByRole("link", { name: browse }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}#product-results$`));
    await expect(page.getByRole("link", { name: seller })).toHaveAttribute("href", `/${locale}/seller/apply`);
  }
});

test("buyer, seller and admin page shells fit small and desktop screens in both locales", async ({ page }) => {
  const routes = ["", "/account", "/cart", "/wishlist", "/seller", "/seller/apply", "/seller/products", "/seller/staff", "/seller/delivery", "/admin/sellers", "/admin/categories", "/owner/admins", "/owner/delivery"];
  for (const width of [320, 1280]) {
    await page.setViewportSize({ width, height: 850 });
    for (const locale of ["en", "ar"]) {
      for (const route of routes) {
        await page.goto(`/${locale}${route}`);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${locale}${route} overflows at ${width}px`).toBe(true);
      }
    }
  }
});

test("portal navigation exposes only the real tools and preserves the active page", async ({ page }) => {
  for (const [locale, current, expected, otherLocale] of [
    ["en", "Products", ["Products"], "ar"],
    ["ar", "\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a", ["\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a"], "en"],
  ]) {
    await page.goto(`/${locale}/seller/products`);
    const nav = page.getByRole("navigation", { name: locale === "ar" ? "\u0623\u062f\u0648\u0627\u062a \u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0639\u0645\u0644" : "Workspace tools" });
    await expect(nav.getByRole("link", { name: current })).toHaveAttribute("aria-current", "page");
    for (const name of expected) await expect(nav.getByRole("link", { name })).toBeVisible();
    await expect(nav.locator('a[href$="/seller/shop"]')).toHaveCount(0);
    await expect(nav.locator('a[href$="/seller/staff"]')).toHaveCount(0);
    await expect(nav.locator('a[href$="/seller/delivery"]')).toHaveCount(0);
    await page.goto(`/${locale}/cart`);
    await page.getByRole("link", { name: otherLocale === "ar" ? "\u0639\u0631\u0628\u064a" : "EN" }).click();
    await expect(page).toHaveURL(new RegExp(`/${otherLocale}/cart$`));
  }
});

test("workspaces use their own navigation on mobile in both languages", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [locale, overview] of [["en", "Overview"], ["ar", "نظرة عامة"]]) {
    for (const section of ["seller", "admin", "owner"]) {
      await page.goto(`/${locale}/${section}`);
      await expect(page.locator(".mobile-bottom-nav")).toHaveCount(0);
      const navigation = page.getByRole("navigation", { name: locale === "ar" ? "أدوات مساحة العمل" : "Workspace tools" });
      await expect(navigation.getByRole("link", { name: overview })).toHaveAttribute("aria-current", "page");
    }
    await page.goto(`/${locale}`);
    await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  }
});

test("signed-out workspace entry points lead to the localized account page", async ({ page }) => {
  for (const locale of ["en", "ar"]) {
    for (const path of ["seller", "seller/products", "admin", "owner"]) {
      await page.goto(`/${locale}/${path}`);
      await expect(page.locator(`.account-card a[href="/${locale}/account"]`)).toBeVisible();
    }
    await page.locator(`.account-card a[href="/${locale}/account"]`).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
  }
});

test("local showcase catalog is clearly labeled and never offers sample checkout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en?showcase=1");
  await expect(page.getByText("Local preview \u00b7 Sample data")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meet local makers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Violet embroidered hoodie" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to cart|Buy now|Checkout/i })).toHaveCount(0);
  await page.getByRole("link", { name: "View product: Violet embroidered hoodie" }).click();
  await expect(page.getByText("Sample product \u00b7 Local preview")).toBeVisible();
  await expect(page.getByRole("button", { name: /Add to cart|Buy now|Checkout/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Add to wishlist|Save to wishlist/i })).toHaveCount(0);
});

test("sample seller dashboard explains its figures and exposes accessible chart data", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en/seller?showcase=1");
  await expect(page.getByRole("heading", { name: "Shop overview" })).toBeVisible();
  await expect(page.getByText("These figures are illustrative, not real sales.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Sales over the last 8 weeks" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Sales over the last 8 weeks" })).toBeVisible();
  await expect(page.getByText("BNF-SAMPLE-1048")).toBeVisible();
  await expect(page.getByText("Sample sales: 24")).toBeVisible();
});

test("catalog facets combine seller options, preserve shareable filters and remove one chip at a time", async ({ page }) => {
  await page.goto("/en?showcase=1");
  await expect(page.getByText("6 products")).toBeVisible();
  await page.locator(".catalog-filter-panel > summary").click();
  await page.getByRole("checkbox", { name: "Violet" }).check();
  await page.getByRole("checkbox", { name: "Black" }).check();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/f=/);
  await expect(page.getByText("3 products")).toBeVisible();
  await expect(page.getByRole("link", { name: /Color: Violet/ })).toBeVisible();
  await page.getByRole("link", { name: /Color: Violet/ }).click();
  await expect(page).toHaveURL(/f=/);
  await expect(page.getByText("1 products")).toBeVisible();
  await expect(page.getByRole("link", { name: /Color: Black/ })).toBeVisible();
  await page.getByRole("link", { name: /Color: Black/ }).click();
  await expect(page).toHaveURL(/showcase=1/);
  await expect(page.getByText("6 products")).toBeVisible();
});

test("search keeps local sample mode while refining the catalog", async ({ page }) => {
  await page.goto("/en?showcase=1");
  await page.getByRole("searchbox", { name: "Search products or shops" }).fill("violet");
  await expect(page).toHaveURL(/q=violet/);
  await expect(page).toHaveURL(/showcase=1/);
  await expect(page.getByText("Local preview · Sample data")).toBeVisible();
});

test("styled sort menu applies choices and reflects filter-panel changes", async ({ page }) => {
  await page.goto("/en?showcase=1&sort=price_low");
  await expect(page.locator(".sort-menu > summary")).toContainText("Price: low to high");
  await page.locator(".sort-menu > summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".sort-menu-list")).toBeVisible();
  await page.locator(".sort-menu-list").getByRole("link", { name: "Price: high to low" }).click();
  await expect(page).toHaveURL(/sort=price_high/);
  await expect(page.locator(".sort-menu > summary")).toContainText("Price: high to low");
  await page.locator(".catalog-filter-panel > summary").click();
  await page.getByRole("radio", { name: "Newest" }).check();
  await page.getByRole("button", { name: "Show results" }).click();
  await expect(page).toHaveURL(/sort=newest/);
  await expect(page.locator(".sort-menu > summary")).toContainText("Newest");
});

test("mobile filter panel keeps choices readable and actions above navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}?showcase=1`);
    await page.locator(".catalog-filter-panel > summary").click();
    await expect(page.locator(".catalog-filter-form")).toBeVisible();
    await expect(page.locator(".filter-choice").first()).toHaveCSS("background-color", "rgb(57, 43, 80)");
    const actions = await page.locator(".filter-actions").boundingBox();
    const navigation = await page.locator(".mobile-bottom-nav").boundingBox();
    expect(actions.y + actions.height).toBeLessThanOrEqual(navigation.y);
    await page.locator(".filter-close").click();
    await expect(page.locator(".catalog-filter-form")).not.toBeVisible();
  }
});

test("saved addresses require sign-in and stay private in both languages", async ({ page }) => {
  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/account/addresses`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.locator("main")).toContainText(locale === "ar" ? "خدمة حفظ العناوين غير مهيأة" : "Address storage is not configured yet");
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex,nofollow");
    await page.getByRole("link", { name: locale === "ar" ? "العودة إلى الحساب" : "Back to account" }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
  }
});

test("shop profile requires an owner and has localized sign-in recovery", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const locale of ["en", "ar"]) {
    await page.goto(`/${locale}/seller/shop`);
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    await expect(page.locator("meta[name=robots]")).toHaveAttribute("content", "noindex,nofollow");
    await expect(page.locator('.portal-nav a[href$="/seller/shop"]')).toHaveCount(0);
    await expect(page.locator("main")).toContainText(locale === "ar" ? "ملف المتجر" : "Shop profile");
    await page.locator(".account-card a[href$='/account']").click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/account$`));
  }
});

test("product page shows related items from the same category without repeating itself", async ({ page }) => {
  await page.goto("/en/p/luna-store/violet-embroidered-hoodie?showcase=1");
  const section = page.getByRole("region", { name: "More in Clothing & shoes" });
  await expect(section.getByRole("link", { name: /Black violet sneakers/ })).toBeVisible();
  await expect(section.getByRole("link", { name: /Violet embroidered hoodie/ })).toHaveCount(0);
  await section.getByRole("link", { name: /Black violet sneakers/ }).click();
  await expect(page).toHaveURL(/black-violet-sneakers\?showcase=1/);
});

test("showcase works in Arabic and stays within narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/ar?showcase=1");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByText("\u0645\u0639\u0627\u064a\u0646\u0629 \u0645\u062d\u0644\u064a\u0629 \u00b7 \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0641\u062a\u0631\u0627\u0636\u064a\u0629")).toBeVisible();
  await expect(page.getByRole("heading", { name: "\u062a\u0639\u0631\u0651\u0641 \u0625\u0644\u0649 \u0635\u064f\u0646\u0651\u0627\u0639 \u0645\u062d\u0644\u064a\u064a\u0646" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto("/ar/seller?showcase=1");
  await expect(page.getByRole("heading", { name: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u062a\u062c\u0631" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
