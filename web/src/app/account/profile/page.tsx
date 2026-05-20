import { createSupabaseServer } from "@/lib/supabase/server";
import { ProfileForms } from "./ProfileForms";

export default async function ProfilePage() {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId!)
    .maybeSingle();

  return (
    <ProfileForms
      email={userData.user?.email ?? ""}
      profile={profile}
    />
  );
}
