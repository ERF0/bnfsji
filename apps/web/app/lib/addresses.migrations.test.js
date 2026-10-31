import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";

test("saved addresses are visible and editable only to their owner", async () => {
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
      insert into auth.users (id) values ('${userA}'), ('${userB}');
    `);
    const path = new URL("../../../../supabase/migrations/202610260003_buyer_addresses.sql", import.meta.url);
    await db.exec(await readFile(path, "utf8"));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userA}';`);
    const saved = await db.query(`insert into public.buyer_addresses
      (user_id,recipient,phone,area,street) values ($1,'Amina','0791234567','Jabal Amman','Rainbow Street') returning id`, [userA]);
    const id = saved.rows[0].id;
    await assert.rejects(db.query(`insert into public.buyer_addresses
      (user_id,recipient,phone,area,street) values ($1,'Other','0791234567','Jabal Amman','Rainbow Street')`, [userB]), /row-level security policy/);
    await db.exec(`set request.jwt.claim.sub = '${userB}';`);
    assert.equal((await db.query("select id from public.buyer_addresses")).rows.length, 0);
    assert.equal((await db.query("update public.buyer_addresses set street = 'Other' where id = $1 returning id", [id])).rows.length, 0);
    assert.equal((await db.query("delete from public.buyer_addresses where id = $1 returning id", [id])).rows.length, 0);
    await db.exec(`set request.jwt.claim.sub = '${userA}';`);
    assert.equal((await db.query("update public.buyer_addresses set street = 'New Street' where id = $1 returning id", [id])).rows.length, 1);
    await assert.rejects(db.query("update public.buyer_addresses set user_id = $1 where id = $2", [userB, id]), /row-level security policy/);
    await db.exec("reset role; set role anon;");
    await assert.rejects(db.query("select id from public.buyer_addresses"), /permission denied/);
  } finally {
    await db.close();
  }
});
