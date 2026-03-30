import { createClient } from "@/lib/supabase/server";
import EventList from "@/components/EventList";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const supabase = await createClient();
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("start_time", { ascending: true });

  return <EventList events={events ?? []} />;
}
