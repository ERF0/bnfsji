import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const shopId = "10000000-0000-4000-8000-000000000001";

test("only an active shop owner can edit the public bilingual profile", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${owner}'), ('${other}');
      create table public.shops (
        id uuid primary key, owner_user_id uuid not null references auth.users(id),
        slug text not null, name_ar text not null, name_en text not null,
        status text not null, updated_at timestamptz not null default now()
      );
      insert into public.shops (id, owner_user_id, slug, name_ar, name_en, status)
        values ('${shopId}', '${owner}', 'luna', 'لونا', 'Luna', 'active');
    `);
    const path = new URL("../../../../supabase/migrations/202610260004_shop_profiles.sql", import.meta.url);
    await db.exec(await readFile(path, "utf8"));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}';`);
    assert.deepEqual((await db.query("select slug, name_en from public.get_my_shop_profile()")).rows, [{ slug: "luna", name_en: "Luna" }]);
    const updated = await db.query("select public.update_my_shop_profile($1,$2,$3,$4,$5) as id", [shopId, "لونا الجديد", "New Luna", "متجر محلي", "Local shop"]);
    assert.equal(updated.rows[0].id, shopId);
    assert.deepEqual((await db.query("select name_en, description_en from public.get_my_shop_profile()")).rows, [{ name_en: "New Luna", description_en: "Local shop" }]);
    await assert.rejects(db.query("select public.update_my_shop_profile($1,'x','New Luna','','')", [shopId]), /invalid shop profile/);
    await db.exec(`set request.jwt.claim.sub = '${other}';`);
    assert.deepEqual((await db.query("select shop_id from public.get_my_shop_profile()")).rows, []);
    await assert.rejects(db.query("select public.update_my_shop_profile($1,'غيري','Other','','')", [shopId]), /not authorized/);
    await db.exec("reset role; update public.shops set status = 'suspended'; set role authenticated;");
    await db.exec(`set request.jwt.claim.sub = '${owner}';`);
    await assert.rejects(db.query("select public.update_my_shop_profile($1,'لونا','Luna','','')", [shopId]), /not authorized/);
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select public.get_my_shop_profile()"), /permission denied/);
    await assert.rejects(db.query("select public.update_my_shop_profile($1,'لونا','Luna','','')", [shopId]), /permission denied/);
  } finally {
    await db.close();
  }
});
