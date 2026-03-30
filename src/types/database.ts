export type UserRole = "admin" | "user";

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
}

export interface Event {
  id: string;
  name: string;
  description: string | null;
  start_time: string;
  end_time: string;
  created_by: string;
  created_at: string;
}

export type EventStatus = "closed" | "open";

export interface Group {
  id: string;
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Row {
  id: string;
  group_id: string;
  label: string;
  number_of_seats: number;
  assigned_user: string | null;
  created_at: string;
}

export interface Seat {
  id: string;
  row_id: string;
  seat_number: number;
  status: "available" | "occupied" | "vip";
  updated_at: string;
  updated_by: string | null;
}

export interface RowWithSeats extends Row {
  seats: Seat[];
}

export interface GroupWithRows extends Group {
  rows: RowWithSeats[];
}

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getEventStatus(event: Event): EventStatus {
  const now = new Date();
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  // Compare dates in local timezone
  const todayStr = toLocalDateStr(now);
  const startDateStr = toLocalDateStr(startDate);

  // Before event date: CLOSED
  if (todayStr < startDateStr) return "closed";

  // After end time: CLOSED
  if (now > endDate) return "closed";

  // On event date and before end time: OPEN
  return "open";
}
