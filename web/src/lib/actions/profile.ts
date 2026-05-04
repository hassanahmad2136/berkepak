"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

export type SaveResult = { ok: true } | { ok: false; error: string };

export async function saveProfile(formData: FormData): Promise<SaveResult> {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
    })
    .eq("id", userData.user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/account/profile");
  return { ok: true };
}

export async function saveMeasurements(formData: FormData): Promise<SaveResult> {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Not signed in." };

  const num = (k: string) => {
    const v = formData.get(k);
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const { error } = await supabase.from("measurements").upsert({
    user_id: userData.user.id,
    chest: num("chest"),
    shoulder: num("shoulder"),
    length: num("length"),
    sleeve: num("sleeve"),
    neck: num("neck"),
    waist: num("waist"),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/account/profile");
  return { ok: true };
}
