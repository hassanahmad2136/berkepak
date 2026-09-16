import { requireUser } from "@/lib/auth/guards";
import { ProfileForms } from "./ProfileForms";

export default async function ProfilePage() {
  const user = await requireUser("/account/profile");

  // `profiles` was merged into `users` when Supabase Auth was removed; the shape
  // ProfileForms expects is unchanged.
  return (
    <ProfileForms
      email={user.email}
      profile={{ full_name: user.fullName, phone: user.phone }}
    />
  );
}
