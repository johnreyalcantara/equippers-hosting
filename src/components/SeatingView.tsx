"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupWithRows, Seat } from "@/types/database";

const LONG_PRESS_MS = 500;

interface SeatingViewProps {
  eventId: string;
  initialGroups: GroupWithRows[];
  currentUserId: string;
  isAdmin: boolean;
  readOnly?: boolean;
}

export default function SeatingView({
  eventId,
  initialGroups,
  currentUserId,
  isAdmin,
  readOnly = false,
}: SeatingViewProps) {
  const [groups, setGroups] = useState<GroupWithRows[]>(initialGroups);
  const supabase = createClient();

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);
  const busyRef = useRef<Set<string>>(new Set());

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  // Calculate live seat counts
  const allSeats = groups.flatMap((g) => g.rows.flatMap((r) => r.seats));
  const totalSeats = allSeats.length;
  const vipSeats = allSeats.filter((s) => s.status === "vip").length;
  const occupiedSeats =
    allSeats.filter((s) => s.status === "occupied").length + vipSeats;
  const availableSeats = totalSeats - occupiedSeats;

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

  function getLatestSeat(seatId: string): Seat | null {
    for (const g of groupsRef.current) {
      for (const r of g.rows) {
        for (const s of r.seats) {
          if (s.id === seatId) return s;
        }
      }
    }
    return null;
  }

  function getRowForSeat(seatId: string) {
    for (const g of groupsRef.current) {
      for (const r of g.rows) {
        for (const s of r.seats) {
          if (s.id === seatId) return r;
        }
      }
    }
    return null;
  }

  function canEditSeat(seatId: string): boolean {
    if (readOnly) return false;
    if (isAdmin) return true;
    const row = getRowForSeat(seatId);
    if (!row) return false;
    if (!row.assigned_user) return true;
    return row.assigned_user === currentUserId;
  }

  async function updateSeatStatus(seatId: string, newStatus: Seat["status"]) {
    if (busyRef.current.has(seatId)) return;
    if (!canEditSeat(seatId)) return;
    const seat = getLatestSeat(seatId);
    if (!seat || seat.status === newStatus) return;

    busyRef.current.add(seatId);
    const oldStatus = seat.status;

    updateSeatInState({ ...seat, status: newStatus });

    const { error } = await supabase
      .from("seats")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", seatId)
      .eq("status", oldStatus);

    if (error) {
      updateSeatInState({ ...seat, status: oldStatus });
    }

    busyRef.current.delete(seatId);
  }

  function handleTap(seatId: string) {
    const seat = getLatestSeat(seatId);
    if (!seat) return;
    if (seat.status === "vip") {
      updateSeatStatus(seatId, "available");
    } else {
      const newStatus = seat.status === "available" ? "occupied" : "available";
      updateSeatStatus(seatId, newStatus);
    }
  }

  function handleLongPress(seatId: string) {
    const seat = getLatestSeat(seatId);
    if (!seat) return;
    const newStatus = seat.status === "vip" ? "available" : "vip";
    updateSeatStatus(seatId, newStatus);
  }

  function onPointerDown(seatId: string) {
    longPressedRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      timerRef.current = null;
      handleLongPress(seatId);
    }, LONG_PRESS_MS);
  }

  function onPointerUp() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function onSeatClick(seatId: string) {
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    handleTap(seatId);
  }

  function seatColor(status: Seat["status"]) {
    switch (status) {
      case "available":
        return "bg-green-400 hover:bg-green-500";
      case "occupied":
        return "bg-red-400 hover:bg-red-500";
      case "vip":
        return "bg-yellow-400 hover:bg-yellow-500";
    }
  }

  return (
    <div>
      {/* Live seat count bar */}
      <div className="sticky top-0 bg-white border-b border-gray-200 py-2 px-1 mb-4 flex flex-wrap gap-3 text-sm z-10">
        <span className="text-green-600 font-medium">
          Available: {availableSeats}
        </span>
        <span className="text-red-600 font-medium">
          Occupied: {occupiedSeats}
        </span>
        <span className="text-yellow-600 font-medium">
          VIP: {vipSeats}
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
                {group.rows.map((row) => {
                  const userCanEdit = !readOnly &&
                    (isAdmin || !row.assigned_user || row.assigned_user === currentUserId);

                  return (
                    <div key={row.id}>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-gray-500 font-medium">
                          {row.label}
                        </p>
                        {!userCanEdit && (
                          <span className="text-[10px] text-gray-400 italic">
                            (assigned to another user)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {row.seats
                          .sort((a, b) => a.seat_number - b.seat_number)
                          .map((seat) => (
                            <button
                              key={seat.id}
                              onTouchStart={userCanEdit ? () => onPointerDown(seat.id) : undefined}
                              onTouchEnd={userCanEdit ? onPointerUp : undefined}
                              onTouchCancel={userCanEdit ? onPointerUp : undefined}
                              onMouseDown={userCanEdit ? () => onPointerDown(seat.id) : undefined}
                              onMouseUp={userCanEdit ? onPointerUp : undefined}
                              onMouseLeave={userCanEdit ? onPointerUp : undefined}
                              onClick={userCanEdit ? () => onSeatClick(seat.id) : undefined}
                              onContextMenu={(e) => e.preventDefault()}
                              style={{ touchAction: "manipulation", WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
                              className={`
                                rounded-2xl border-2 border-black w-12 h-12 flex items-center justify-center
                                font-bold text-sm transition-all duration-200 select-none
                                ${seatColor(seat.status)}
                                ${userCanEdit ? "active:scale-90 cursor-pointer" : "opacity-60 cursor-not-allowed"}
                              `}
                            >
                              {seat.seat_number}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
