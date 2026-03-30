"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useParams } from "next/navigation";
import type { Group, RowWithSeats } from "@/types/database";

export default function SeatingManagementPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const supabase = createClient();
  const [groups, setGroups] = useState<(Group & { rows: RowWithSeats[] })[]>(
    []
  );
  const [newGroupName, setNewGroupName] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadGroups() {
    const { data } = await supabase
      .from("groups")
      .select("*, rows(*, seats(*))")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (data) {
      setGroups(
        data.map((g) => ({
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
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function addGroup() {
    if (!newGroupName.trim()) return;
    await supabase.from("groups").insert({
      event_id: eventId,
      name: newGroupName.trim(),
      sort_order: groups.length,
    });
    setNewGroupName("");
    loadGroups();
  }

  async function deleteGroup(groupId: string) {
    if (!confirm("Delete this group and all its rows/seats?")) return;
    // Seats cascade from rows, rows cascade from groups
    await supabase.from("groups").delete().eq("id", groupId);
    loadGroups();
  }

  async function addRow(groupId: string) {
    const label = prompt("Row label (e.g. Row 1, A, etc.):");
    if (!label) return;
    const seatsStr = prompt("Number of seats:");
    if (!seatsStr) return;
    const seats = parseInt(seatsStr, 10);
    if (isNaN(seats) || seats < 1) {
      alert("Invalid number of seats");
      return;
    }

    // Create the row
    const { data: newRow, error: rowError } = await supabase
      .from("rows")
      .insert({
        group_id: groupId,
        label,
        number_of_seats: seats,
      })
      .select()
      .single();

    if (rowError || !newRow) {
      alert("Failed to create row: " + (rowError?.message ?? "Unknown error"));
      return;
    }

    // Create individual seat records
    const seatRecords = Array.from({ length: seats }, (_, i) => ({
      row_id: newRow.id,
      seat_number: i + 1,
      status: "available" as const,
    }));

    await supabase.from("seats").insert(seatRecords);
    loadGroups();
  }

  async function deleteRow(rowId: string) {
    if (!confirm("Delete this row and all its seats?")) return;
    // Seats cascade from rows
    await supabase.from("rows").delete().eq("id", rowId);
    loadGroups();
  }

  async function copyRowsFrom(sourceGroupId: string, targetGroupId: string) {
    const sourceGroup = groups.find((g) => g.id === sourceGroupId);
    if (!sourceGroup || sourceGroup.rows.length === 0) {
      alert("Source group has no rows to copy.");
      return;
    }

    if (
      !confirm(
        `Copy ${sourceGroup.rows.length} row(s) from "${sourceGroup.name}"? Existing rows in this group will be kept.`
      )
    )
      return;

    for (const row of sourceGroup.rows) {
      // Create each row
      const { data: newRow, error: rowError } = await supabase
        .from("rows")
        .insert({
          group_id: targetGroupId,
          label: row.label,
          number_of_seats: row.number_of_seats,
        })
        .select()
        .single();

      if (rowError || !newRow) continue;

      // Create seats for the row
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

    loadGroups();
  }

  async function resetAllSeats() {
    if (!confirm("Reset ALL seats to available?")) return;
    const allRowIds = groups.flatMap((g) => g.rows.map((r) => r.id));
    for (const rowId of allRowIds) {
      await supabase
        .from("seats")
        .update({ status: "available" })
        .eq("row_id", rowId);
    }
    loadGroups();
  }

  if (loading) {
    return <p className="text-gray-500">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Manage Seating</h1>
        <button
          onClick={resetAllSeats}
          className="px-3 py-1.5 text-sm bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
        >
          Reset All Seats
        </button>
      </div>

      {/* Add group */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="Group name (e.g. Section A)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === "Enter" && addGroup()}
        />
        <button
          onClick={addGroup}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Add Group
        </button>
      </div>

      {/* Groups and rows */}
      <div className="space-y-6">
        {groups.map((group) => (
          <div key={group.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{group.name}</h3>
              <div className="flex gap-2 items-center">
                {groups.filter((g) => g.id !== group.id && g.rows.length > 0)
                  .length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        copyRowsFrom(e.target.value, group.id);
                        e.target.value = "";
                      }
                    }}
                    className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="" disabled>
                      Copy from...
                    </option>
                    {groups
                      .filter((g) => g.id !== group.id && g.rows.length > 0)
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.rows.length} rows)
                        </option>
                      ))}
                  </select>
                )}
                <button
                  onClick={() => addRow(group.id)}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  + Row
                </button>
                <button
                  onClick={() => deleteGroup(group.id)}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
            {group.rows.length === 0 ? (
              <p className="text-sm text-gray-400">No rows yet</p>
            ) : (
              <div className="space-y-2">
                {group.rows.map((row) => {
                  const occupied = row.seats.filter(
                    (s) => s.status === "occupied"
                  ).length;
                  return (
                    <div
                      key={row.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{row.label}</span>
                        <span className="text-xs text-gray-400">
                          {row.number_of_seats} seats
                        </span>
                        {occupied > 0 && (
                          <span className="text-xs text-red-500">
                            {occupied} occupied
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteRow(row.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
