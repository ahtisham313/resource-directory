import { z } from "zod";

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const hoursSchema = z.object({
  startDay: z.string(),
  endDay: z.string(),
  startTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
});
const dayIndex = (day: string) =>
  days.findIndex((value) => value.toLowerCase() === day.trim().toLowerCase());
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const timeLabel = (time: number) =>
  `${Math.floor(time / 60) % 12 || 12}:${String(time % 60).padStart(2, "0")} ${time < 720 ? "AM" : "PM"}`;

export function officeStatus(input: unknown, timeZone: string, now: Date) {
  const unavailable = {
    officeHours: "Hours unavailable",
    openState: "Hours unavailable" as const,
  };
  const parsed = hoursSchema.safeParse(input);
  if (!parsed.success) return unavailable;
  const hours = parsed.data;
  const start = dayIndex(hours.startDay),
    end = dayIndex(hours.endDay);
  const opening = minutes(hours.startTime),
    closing = minutes(hours.endTime);
  if (start < 0 || end < 0 || opening === closing) return unavailable;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const part = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";
    const day = dayIndex(part("weekday"));
    const current = Number(part("hour")) * 60 + Number(part("minute"));
    const scheduled = (day: number) =>
      (day - start + 7) % 7 <= (end - start + 7) % 7;
    // An overnight shift belongs to its starting day, including Saturday -> Sunday.
    const open =
      opening < closing
        ? scheduled(day) && current >= opening && current < closing
        : (scheduled(day) && current >= opening) ||
          (scheduled((day + 6) % 7) && current < closing);
    return {
      officeHours: `${start === end ? days[start] : `${days[start]}–${days[end]}`} · ${timeLabel(opening)}–${timeLabel(closing)}${opening > closing ? " (next day)" : ""}`,
      openState: open ? ("Open" as const) : ("Closed" as const),
    };
  } catch {
    return unavailable;
  }
}
