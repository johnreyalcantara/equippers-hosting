import EventDetail from "@/components/EventDetail";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <EventDetail
      event={event}
      groups={sortedGroups}
      currentUserId={user!.id}
      isAdmin={isAdmin}
    />
  );
}
