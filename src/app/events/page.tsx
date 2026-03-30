import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { getEventStatus } from "@/types/database";
import type { Event } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("start_time", { ascending: true });

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Events</h1>
      {!events || events.length === 0 ? (
        <p className="text-gray-500">No events yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event: Event) => {
            const status = getEventStatus(event);
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold text-lg">{event.name}</h2>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      status === "open"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {status.toUpperCase()}
                  </span>
                </div>
                {event.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {event.description}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {new Date(event.start_time).toLocaleDateString()} &mdash;{" "}
                  {new Date(event.end_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
