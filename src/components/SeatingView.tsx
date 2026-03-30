"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupWithRows, Seat } from "@/types/database";

interface SeatingViewProps {
  eventId: string;
  initialGroups: GroupWithRows[];
}

export default function SeatingView({
  eventId,
  initialGroups,
}: SeatingViewProps) {
  const [groups, setGroups] = useState<GroupWithRows[]>(initialGroups);
  const [toggling, setToggling] = useState<string | null>(null);
  const supabase = createClient();

  // Calculate live seat counts
  const allSeats = groups.flatMap((g) => g.rows.flatMap((r) => r.seats));
  const totalSeats = allSeats.length;
  const occupiedSeats = allSeats.filter((s) => s.status === "occupied").length;

  const updateSeatInState = useCallback((updatedSeat: Seat) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        rows: group.rows.map((row) => ({
          ...row,
          seats: row.seats.map((seat) =>
            seat.id === updatedSeat.id ? { ...seat, ...updatedSeat } : seat
          ),
        })),
      }))
    );
  }, []);

  // Subscribe to real-time changes on the seats table
  useEffect(() => {
    const rowIds = groups.flatMap((g) => g.rows.map((r) => r.id));
    if (rowIds.length === 0) return;

    const channel = supabase
      .channel(`seating-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "seats",
        },
        (payload) => {
          const updatedSeat = payload.new as Seat;
          if (rowIds.includes(updatedSeat.row_id)) {
            updateSeatInState(updatedSeat);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, groups, supabase, updateSeatInState]);

  async function toggleSeat(seat: Seat) {
    if (toggling) return;
    setToggling(seat.id);

    const newStatus = seat.status === "available" ? "occupied" : "available";

    // Optimistic update
    updateSeatInState({ ...seat, status: newStatus });

    const { error } = await supabase
      .from("seats")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seat.id)
      .eq("status", seat.status); // Optimistic lock

    if (error) {
      updateSeatInState(seat);
    }

    setToggling(null);
  }

  return (
    <div>
      {/* Live seat count bar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 py-2 px-1 mb-4 flex gap-4 text-sm z-10">
        <span className="text-green-600 font-medium">
          Available: {totalSeats - occupiedSeats}
        </span>
        <span className="text-red-600 font-medium">
          Occupied: {occupiedSeats}
        </span>
        <span className="text-gray-500">Total: {totalSeats}</span>
      </div>

      {groups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          No seating groups configured for this event.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.id}>
              <h3 className="font-semibold text-sm text-gray-700 mb-2 uppercase tracking-wide">
                {group.name}
              </h3>
              <div className="space-y-3">
                {group.rows.map((row) => (
                  <div key={row.id}>
                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      {row.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {row.seats
                        .sort((a, b) => a.seat_number - b.seat_number)
                        .map((seat) => (
                          <button
                            key={seat.id}
                            onClick={() => toggleSeat(seat)}
                            disabled={toggling === seat.id}
                            className={`
                              rounded-2xl border-2 border-black w-12 h-12 flex items-center justify-center
                              font-bold text-sm transition-all duration-200 active:scale-90
                              ${
                                seat.status === "available"
                                  ? "bg-green-400 hover:bg-green-500"
                                  : "bg-red-400 hover:bg-red-500"
                              }
                              ${toggling === seat.id ? "opacity-50" : ""}
                            `}
                          >
                            {seat.seat_number}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
