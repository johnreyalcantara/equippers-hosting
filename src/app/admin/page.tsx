import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: eventCount }, { count: userCount }] = await Promise.all([
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold">{eventCount ?? 0}</p>
          <p className="text-sm text-gray-500">Events</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-3xl font-bold">{userCount ?? 0}</p>
          <p className="text-sm text-gray-500">Users</p>
        </div>
      </div>
    </div>
  );
}
