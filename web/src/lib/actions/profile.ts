"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveProfile(formData: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await query(
    `update users set full_name = $1, phone = $2 where id = $3`,
    [String(formData.get("fullName") ?? ""), String(formData.get("phone") ?? ""), user.id],
  );

  revalidatePath("/account/profile");
  return { ok: true };
}

export async function saveMeasurements(formData: FormData): Promise<SaveResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  await query(
    `insert into measurements (user_id, chest, shoulder, length, sleeve, neck, waist)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id) do update set
       chest = excluded.chest, shoulder = excluded.shoulder, length = excluded.length,
       sleeve = excluded.sleeve, neck = excluded.neck, waist = excluded.waist`,
    [user.id, num("chest"), num("shoulder"), num("length"), num("sleeve"), num("neck"), num("waist")],
  );

  revalidatePath("/account/profile");
  return { ok: true };
}
