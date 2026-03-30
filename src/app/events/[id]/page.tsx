import SeatingView from "@/components/SeatingView";
import { createClient } from "@/lib/supabase/server";
import { getEventStatus } from "@/types/database";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (!event) notFound();

  const status = getEventStatus(event);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const { data: groups } = await supabase
    .from("groups")
    .select("*, rows(*, seats(*))")
    .eq("event_id", id)
    .order("sort_order", { ascending: true });

  // Sort rows and seats within each group
  const sortedGroups = (groups ?? []).map((g) => ({
    ...g,
    rows: (g.rows ?? [])
      .sort((a: { label: string }, b: { label: string }) =>
        a.label.localeCompare(b.label, undefined, { numeric: true })
      )
      .map((r: { seats?: { seat_number: number }[] }) => ({
        ...r,
        seats: (r.seats ?? []).sort(
          (a: { seat_number: number }, b: { seat_number: number }) =>
            a.seat_number - b.seat_number
        ),
      })),
  }));

  // Calculate seat counts
  const allSeats = sortedGroups.flatMap((g) =>
    g.rows.flatMap((r: { seats: { status: string }[] }) => r.seats)
  );
  const totalSeats = allSeats.length;
  const occupiedSeats = allSeats.filter(
    (s: { status: string }) => s.status === "occupied"
  ).length;
  const vipSeats = allSeats.filter(
    (s: { status: string }) => s.status === "vip"
  ).length;
  const availableSeats = totalSeats - occupiedSeats - vipSeats;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">{event.name}</h1>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${status === "open"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
              }`}
          >
            {status.toUpperCase()}
          </span>
        </div>
        {event.description && (
          <p className="text-sm text-gray-600 mb-2">{event.description}</p>
        )}
        <p className="text-xs text-gray-400">
          {new Date(event.start_time).toLocaleDateString()} &mdash;{" "}
          {new Date(event.end_time).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {status === "closed" ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center text-sm text-yellow-800">
          This event is currently closed. Seating is not available.
        </div>
      ) : (
        <SeatingView eventId={id} initialGroups={sortedGroups} currentUserId={user!.id} isAdmin={isAdmin} />
      )}
    </div>
  );
}
