"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroupWithRows, Seat } from "@/types/database";

const LONG_PRESS_MS = 500;

interface SeatingViewProps {
  eventId: string;
  initialGroups: GroupWithRows[];
}

export default function SeatingView({
  eventId,
  initialGroups,
}: SeatingViewProps) {
  const [groups, setGroups] = useState<GroupWithRows[]>(initialGroups);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const supabase = createClient();
  const pressState = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    didLongPress: boolean;
    seatId: string | null;
    startX: number;
    startY: number;
    isTouch: boolean;
    lastTouchEnd: number;
  }>({ timer: null, didLongPress: false, seatId: null, startX: 0, startY: 0, isTouch: false, lastTouchEnd: 0 });

  // Calculate live seat counts
  const allSeats = groups.flatMap((g) => g.rows.flatMap((r) => r.seats));
  const totalSeats = allSeats.length;
  const occupiedSeats = allSeats.filter((s) => s.status === "occupied").length;
  const vipSeats = allSeats.filter((s) => s.status === "vip").length;
  const availableSeats = totalSeats - occupiedSeats - vipSeats;

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

  async function updateSeatStatus(seat: Seat, newStatus: Seat["status"]) {
    if (toggling.has(seat.id)) return;
    setToggling((prev) => new Set(prev).add(seat.id));

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

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(seat.id);
      return next;
    });
  }

  function handleTap(seat: Seat) {
    // Tap cycles: available → occupied → available
    // If VIP, tap turns it back to available
    if (seat.status === "vip") {
      updateSeatStatus(seat, "available");
    } else {
      const newStatus = seat.status === "available" ? "occupied" : "available";
      updateSeatStatus(seat, newStatus);
    }
  }

  function handleLongPress(seat: Seat) {
    // Long press toggles VIP
    const newStatus = seat.status === "vip" ? "available" : "vip";
    updateSeatStatus(seat, newStatus);
  }

  function clearPress() {
    if (pressState.current.timer) {
      clearTimeout(pressState.current.timer);
      pressState.current.timer = null;
    }
  }

  function onTouchPressStart(seat: Seat, clientX: number, clientY: number) {
    clearPress();
    pressState.current = {
      ...pressState.current,
      timer: null,
      didLongPress: false,
      seatId: seat.id,
      startX: clientX,
      startY: clientY,
      isTouch: true,
    };
    pressState.current.timer = setTimeout(() => {
      pressState.current.didLongPress = true;
      pressState.current.timer = null;
      handleLongPress(seat);
    }, LONG_PRESS_MS);
  }

  function onMousePressStart(seat: Seat, clientX: number, clientY: number) {
    // Ignore synthetic mouse events after touch
    if (Date.now() - pressState.current.lastTouchEnd < 500) return;
    clearPress();
    pressState.current = {
      ...pressState.current,
      timer: null,
      didLongPress: false,
      seatId: seat.id,
      startX: clientX,
      startY: clientY,
      isTouch: false,
    };
    pressState.current.timer = setTimeout(() => {
      pressState.current.didLongPress = true;
      pressState.current.timer = null;
      handleLongPress(seat);
    }, LONG_PRESS_MS);
  }

  function onTouchPressEnd(seat: Seat) {
    if (pressState.current.seatId !== seat.id) return;
    clearPress();
    pressState.current.lastTouchEnd = Date.now();
    if (!pressState.current.didLongPress) {
      handleTap(seat);
    }
    pressState.current.seatId = null;
  }

  function onMousePressEnd(seat: Seat) {
    // Ignore synthetic mouse events after touch
    if (Date.now() - pressState.current.lastTouchEnd < 500) return;
    if (pressState.current.seatId !== seat.id) return;
    clearPress();
    if (!pressState.current.didLongPress) {
      handleTap(seat);
    }
    pressState.current.seatId = null;
  }

  function onPressMove(clientX: number, clientY: number) {
    // Cancel long press if finger moved more than 10px
    const dx = clientX - pressState.current.startX;
    const dy = clientY - pressState.current.startY;
    if (dx * dx + dy * dy > 100) {
      clearPress();
    }
  }

  function onPressCancel() {
    clearPress();
    pressState.current.seatId = null;
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
                            onMouseDown={(e) => onMousePressStart(seat, e.clientX, e.clientY)}
                            onMouseUp={() => onMousePressEnd(seat)}
                            onMouseLeave={onPressCancel}
                            onTouchStart={(e) => {
                              const touch = e.touches[0];
                              onTouchPressStart(seat, touch.clientX, touch.clientY);
                            }}
                            onTouchMove={(e) => {
                              const touch = e.touches[0];
                              onPressMove(touch.clientX, touch.clientY);
                            }}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              onTouchPressEnd(seat);
                            }}
                            onTouchCancel={onPressCancel}
                            onContextMenu={(e) => e.preventDefault()}
                            disabled={toggling.has(seat.id)}
                            style={{ touchAction: "none", WebkitTouchCallout: "none" }}
                            className={`
                              rounded-2xl border-2 border-black w-12 h-12 flex items-center justify-center
                              font-bold text-sm transition-all duration-200 active:scale-90 select-none
                              ${seatColor(seat.status)}
                              ${toggling.has(seat.id) ? "opacity-50" : ""}
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
