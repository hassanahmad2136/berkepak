"use client";

import { useState, useTransition } from "react";
import { saveMeasurements, saveProfile } from "@/lib/actions/profile";

type Profile = { full_name: string | null; phone: string | null } | null;
type Measurements = {
  chest: number | null;
  shoulder: number | null;
  length: number | null;
  sleeve: number | null;
  neck: number | null;
  waist: number | null;
} | null;

export function ProfileForms({
  email,
  profile,
}: {
  email: string;
  profile: Profile;
}) {
  return (
    <div className="space-y-12">
      <ProfileSection email={email} profile={profile} />
    </div>
  );
}

function ProfileSection({ email, profile }: { email: string; profile: Profile }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <section>
      <h2 className="display text-2xl">Profile</h2>
      <p className="mt-2 text-sm text-muted">
        Manage your name and mobile number.
      </p>
      <form
        className="mt-6 grid gap-3 max-w-md"
        action={(fd) => {
          setMsg(null);
          startTransition(async () => {
            const res = await saveProfile(fd);
            setMsg(res.ok ? "Saved." : res.error);
          });
        }}
      >
        <input
          className="input"
          name="fullName"
          placeholder="Full name"
          defaultValue={profile?.full_name ?? ""}
        />
        <input className="input" value={email} disabled />
        <input
          className="input"
          name="phone"
          placeholder="Mobile number"
          type="tel"
          defaultValue={profile?.phone ?? ""}
        />
        {msg && <p className="text-xs text-muted">{msg}</p>}
        <button className="btn btn-primary mt-2 self-start" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}

function MeasurementsSection({ measurements }: { measurements: Measurements }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const fields: { name: keyof NonNullable<Measurements>; label: string }[] = [
    { name: "chest", label: "Chest" },
    { name: "shoulder", label: "Shoulder" },
    { name: "length", label: "Length" },
    { name: "sleeve", label: "Sleeve" },
    { name: "neck", label: "Neck" },
    { name: "waist", label: "Waist" },
  ];

  return (
    <section>
      <h2 className="display text-2xl">Measurement profile</h2>
      <p className="mt-2 text-sm text-muted">
        Used for bespoke stitching. All measurements in inches.
      </p>
      <form
        className="mt-6 grid gap-3 max-w-xl sm:grid-cols-2"
        action={(fd) => {
          setMsg(null);
          startTransition(async () => {
            const res = await saveMeasurements(fd);
            setMsg(res.ok ? "Saved." : res.error);
          });
        }}
      >
        {fields.map((f) => (
          <input
            key={f.name}
            className="input"
            name={f.name}
            placeholder={f.label}
            type="number"
            step="0.25"
            defaultValue={measurements?.[f.name] ?? ""}
          />
        ))}
        {msg && <p className="text-xs text-muted sm:col-span-2">{msg}</p>}
        <button
          className="btn btn-primary mt-2 self-start sm:col-span-2"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save Measurements"}
        </button>
      </form>
    </section>
  );
}
