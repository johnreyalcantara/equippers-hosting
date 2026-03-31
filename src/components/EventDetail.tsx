"use client";

import { useState } from "react";
import { getEventStatus } from "@/types/database";
import type { Event, GroupWithRows } from "@/types/database";
import SeatingView from "./SeatingView";

interface EventDetailProps {
  event: Event;
  groups: GroupWithRows[];
  currentUserId: string;
  isAdmin: boolean;
}

export default function EventDetail({
  event,
  groups,
  currentUserId,
  isAdmin,
}: EventDetailProps) {
  const status = getEventStatus(event);
  const [mode, setMode] = useState<"view" | "edit">("view");

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">{event.name}</h1>
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
        <>
          {/* Mode toggle */}
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="view"
                checked={mode === "view"}
                onChange={() => setMode("view")}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">Viewing</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="mode"
                value="edit"
                checked={mode === "edit"}
                onChange={() => setMode("edit")}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">Editing</span>
            </label>
          </div>

          <SeatingView
            eventId={event.id}
            initialGroups={groups}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            readOnly={mode === "view"}
          />
        </>
      )}
    </div>
  );
}
