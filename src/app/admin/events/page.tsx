"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Event } from "@/types/database";

export default function AdminEventsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [copying, setCopying] = useState<string | null>(null);

  async function loadEvents() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .order("start_time", { ascending: false });
    if (data) setEvents(data);
  }

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function copyEvent(event: Event) {
    if (copying) return;
    if (!confirm(`Duplicate "${event.name}" with all groups, rows, and seats?`))
      return;

    setCopying(event.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Create new event
    const { data: newEvent, error: eventErr } = await supabase
      .from("events")
      .insert({
        name: `${event.name} (Copy)`,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        created_by: user!.id,
      })
      .select()
      .single();

    if (eventErr || !newEvent) {
      alert("Failed to copy event: " + (eventErr?.message ?? "Unknown error"));
      setCopying(null);
      return;
    }

    // 2. Fetch all groups with rows and seats
    const { data: groups } = await supabase
      .from("groups")
      .select("*, rows(*, seats(*))")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });

    // 3. Recreate groups → rows → seats
    for (const group of groups ?? []) {
      const { data: newGroup } = await supabase
        .from("groups")
        .insert({
          event_id: newEvent.id,
          name: group.name,
          sort_order: group.sort_order,
        })
        .select()
        .single();

      if (!newGroup) continue;

      for (const row of group.rows ?? []) {
        const { data: newRow } = await supabase
          .from("rows")
          .insert({
            group_id: newGroup.id,
            label: row.label,
            number_of_seats: row.number_of_seats,
          })
          .select()
          .single();

        if (!newRow) continue;

        const seatRecords = Array.from(
          { length: row.number_of_seats },
          (_, i) => ({
            row_id: newRow.id,
            seat_number: i + 1,
            status: "available" as const,
          })
        );

        await supabase.from("seats").insert(seatRecords);
      }
    }

    setCopying(null);
    loadEvents();
    router.refresh();
  }

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
      {events.length === 0 ? (
        <p className="text-gray-500">No events created yet.</p>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
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
                <button
                  onClick={() => copyEvent(event)}
                  disabled={copying === event.id}
                  className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {copying === event.id ? "Copying..." : "Duplicate"}
                </button>
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
