"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Event } from "@/types/database";
import { getEventStatus } from "@/types/database";

interface EventExportData {
  event: Event;
  groups: {
    name: string;
    rows: {
      label: string;
      assigned_user_name: string | null;
      seats: { seat_number: number; status: string }[];
    }[];
  }[];
}

export default function AdminEventsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [copying, setCopying] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

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

  async function fetchEventData(event: Event): Promise<EventExportData> {
    const { data: groups } = await supabase
      .from("groups")
      .select("*, rows(*, seats(*))")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });

    // Get all user IDs from assigned rows
    const userIds = new Set<string>();
    for (const g of groups ?? []) {
      for (const r of g.rows ?? []) {
        if (r.assigned_user) userIds.add(r.assigned_user);
      }
    }

    // Fetch user profiles
    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(userIds));
      for (const p of profiles ?? []) {
        userMap.set(p.id, p.full_name || p.email);
      }
    }

    return {
      event,
      groups: (groups ?? []).map((g) => ({
        name: g.name,
        rows: (g.rows ?? [])
          .sort((a: { label: string }, b: { label: string }) =>
            a.label.localeCompare(b.label, undefined, { numeric: true })
          )
          .map((r: { label: string; assigned_user: string | null; number_of_seats: number; seats?: { seat_number: number; status: string }[] }) => ({
            label: r.label,
            assigned_user_name: r.assigned_user
              ? userMap.get(r.assigned_user) ?? "Unknown"
              : null,
            seats: (r.seats ?? [])
              .sort((a: { seat_number: number }, b: { seat_number: number }) => a.seat_number - b.seat_number),
          })),
      })),
    };
  }

  async function exportCSV(event: Event) {
    setExporting(event.id);
    const data = await fetchEventData(event);

    const lines: string[] = [];
    lines.push("Group,Row,Assigned User,Seat #,Status");

    for (const group of data.groups) {
      for (const row of group.rows) {
        for (const seat of row.seats) {
          lines.push(
            [
              `"${group.name}"`,
              `"${row.label}"`,
              `"${row.assigned_user_name ?? "Anyone"}"`,
              seat.seat_number,
              seat.status,
            ].join(",")
          );
        }
      }
    }

    // Add summary totals
    const allSeats = data.groups.flatMap((g) => g.rows.flatMap((r) => r.seats));
    const total = allSeats.length;
    const vip = allSeats.filter((s) => s.status === "vip").length;
    const occupied = allSeats.filter((s) => s.status === "occupied").length + vip;
    const available = total - occupied;

    lines.push("");
    lines.push("Summary,,,,");
    lines.push(`Total Seats,,,,${total}`);
    lines.push(`Available,,,,${available}`);
    lines.push(`Occupied,,,,${occupied}`);
    lines.push(`VIP,,,,${vip}`);

    const csv = lines.join("\n");
    downloadFile(
      csv,
      `${event.name.replace(/[^a-zA-Z0-9]/g, "_")}_seating.csv`,
      "text/csv"
    );
    setExporting(null);
  }

  async function exportPDF(event: Event) {
    setExporting(event.id);
    const data = await fetchEventData(event);

    // Calculate totals
    const allSeats = data.groups.flatMap((g) =>
      g.rows.flatMap((r) => r.seats)
    );
    const total = allSeats.length;
    const vip = allSeats.filter((s) => s.status === "vip").length;
    const occupied = allSeats.filter((s) => s.status === "occupied").length + vip;
    const available = total - occupied;

    // Build HTML for print/PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${event.name} - Seating Report</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #888; margin-bottom: 16px; }
    .summary { display: flex; gap: 20px; margin-bottom: 20px; font-size: 14px; }
    .summary span { font-weight: bold; }
    .green { color: #16a34a; } .red { color: #dc2626; } .yellow { color: #ca8a04; } .gray { color: #6b7280; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; font-weight: 600; }
    .available { background: #bbf7d0; }
    .occupied { background: #fecaca; }
    .vip { background: #fef08a; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${event.name}</h1>
  <div class="meta">
    ${new Date(event.start_time).toLocaleString()} &mdash; ${new Date(event.end_time).toLocaleString()}
    ${event.description ? `<br/>${event.description}` : ""}
  </div>
  <div class="summary">
    <span class="green">Available: ${available}</span>
    <span class="red">Occupied: ${occupied}</span>
    <span class="yellow">VIP: ${vip}</span>
    <span class="gray">Total: ${total}</span>
  </div>
  ${data.groups
    .map(
      (group) => `
    <h3 style="font-size:14px;margin:12px 0 4px;">${group.name}</h3>
    <table>
      <thead><tr><th>Row</th><th>Assigned User</th><th>Seats</th></tr></thead>
      <tbody>
        ${group.rows
          .map(
            (row) => `
          <tr>
            <td><strong>${row.label}</strong></td>
            <td>${row.assigned_user_name ?? "Anyone"}</td>
            <td>${row.seats
              .map(
                (s) =>
                  `<span class="${s.status}" style="display:inline-block;width:24px;height:24px;line-height:24px;text-align:center;border:1px solid #666;border-radius:6px;margin:1px;font-size:11px;">${s.seat_number}</span>`
              )
              .join("")}</td>
          </tr>`
          )
          .join("")}
      </tbody>
    </table>`
    )
    .join("")}
</body>
</html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
    setExporting(null);
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetEventSeats(event: Event) {
    if (
      !confirm(
        `Reset ALL seats for "${event.name}" to available? This cannot be undone.`
      )
    )
      return;

    const { data: groups } = await supabase
      .from("groups")
      .select("id, rows(id)")
      .eq("event_id", event.id);

    const allRowIds = (groups ?? []).flatMap((g) =>
      (g.rows ?? []).map((r: { id: string }) => r.id)
    );

    for (const rowId of allRowIds) {
      await supabase
        .from("seats")
        .update({ status: "available" })
        .eq("row_id", rowId);
    }

    alert("All seats have been reset to available.");
  }

  async function copyEvent(event: Event) {
    if (copying) return;
    if (!confirm(`Duplicate "${event.name}" with all groups, rows, and seats?`))
      return;

    setCopying(event.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    const { data: groups } = await supabase
      .from("groups")
      .select("*, rows(*, seats(*))")
      .eq("event_id", event.id)
      .order("sort_order", { ascending: true });

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
          {events.map((event) => {
            const status = getEventStatus(event);
            return (
              <div
                key={event.id}
                className="bg-white rounded-xl border p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{event.name}</h2>
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          status === "open"
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(event.start_time).toLocaleDateString()}{" "}
                      {new Date(event.start_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      &mdash;{" "}
                      {new Date(event.end_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => exportCSV(event)}
                    disabled={exporting === event.id}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => exportPDF(event)}
                    disabled={exporting === event.id}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    PDF
                  </button>
                  <button
                    onClick={() => resetEventSeats(event)}
                    className="px-3 py-1.5 text-sm border border-yellow-300 text-yellow-700 rounded-lg hover:bg-yellow-50"
                  >
                    Reset Seats
                  </button>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
