import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Event } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("start_time", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Manage Events</h1>
        <Link
          href="/admin/events/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New Event
        </Link>
      </div>
      {!events || events.length === 0 ? (
        <p className="text-gray-500">No events created yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event: Event) => (
            <div
              key={event.id}
              className="bg-white rounded-xl border p-4 flex items-center justify-between"
            >
              <div>
                <h2 className="font-semibold">{event.name}</h2>
                <p className="text-xs text-gray-400">
                  {new Date(event.start_time).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/admin/events/${event.id}`}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/admin/events/${event.id}/seating`}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Seating
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
