import { describe, expect, it } from "vitest";
import { addMonths, jakartaParts, scheduleSlots, uploadCovers, type ScheduleClock } from "./periods";

function atJakarta(iso: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0));
}

const daily: ScheduleClock = { id: "harian", granularity: "DAILY", cutoffTime: "10:00", dayOfWeek: null, dayOfMonth: null };

describe("upload schedule periods", () => {
  it("reads the Jakarta calendar date", () => {
    expect(jakartaParts(atJakarta("2026-10-08", "10:05"))).toEqual({ date: "2026-10-08", minutes: 10 * 60 + 5 });
  });

  it("marks today due only after the daily cutoff", () => {
    expect(scheduleSlots(daily, atJakarta("2026-10-08", "09:59")).due).toEqual({ from: "2026-10-07", to: "2026-10-07", due: true });
    expect(scheduleSlots(daily, atJakarta("2026-10-08", "09:59")).upcoming).toEqual({ from: "2026-10-08", to: "2026-10-08", due: false });
    expect(scheduleSlots(daily, atJakarta("2026-10-08", "10:00")).due).toEqual({ from: "2026-10-08", to: "2026-10-08", due: true });
  });

  it("expects a seven-day window ending on the configured weekday", () => {
    const weekly: ScheduleClock = { id: "mingguan", granularity: "WEEKLY", cutoffTime: "10:00", dayOfWeek: 5, dayOfMonth: null };
    const slots = scheduleSlots(weekly, atJakarta("2026-10-08", "12:00"));
    expect(slots.due).toEqual({ from: "2026-09-26", to: "2026-10-02", due: true });
    expect(slots.upcoming?.due).toBe(false);
    expect(slots.upcoming?.to).toBe("2026-10-09");
  });

  it("expects the cycle that ends the day before a monthly due date", () => {
    const monthly: ScheduleClock = { id: "bulanan", granularity: "MONTHLY", cutoffTime: "10:00", dayOfWeek: null, dayOfMonth: 10 };
    expect(addMonths("2026-10-10", -1)).toBe("2026-09-10");
    expect(scheduleSlots(monthly, atJakarta("2026-10-10", "10:00")).due).toEqual({ from: "2026-09-10", to: "2026-10-09", due: true });
    expect(scheduleSlots(monthly, atJakarta("2026-10-08", "12:00")).upcoming).toEqual({ from: "2026-09-10", to: "2026-10-09", due: false });
  });

  it("accepts only a matching granularity that overlaps the slot", () => {
    const slot = { from: "2026-10-08", to: "2026-10-08", due: true };
    expect(uploadCovers({ granularity: "DAILY", periodStart: "2026-10-08", periodEnd: "2026-10-08", status: "PARSED" }, "DAILY", slot)).toBe(true);
    expect(uploadCovers({ granularity: "DAILY", periodStart: "2026-10-08", periodEnd: "2026-10-08", status: "REJECTED" }, "DAILY", slot)).toBe(false);
    expect(uploadCovers({ granularity: "MONTHLY", periodStart: "2026-09-10", periodEnd: "2026-10-09", status: "PARSED" }, "DAILY", slot)).toBe(false);
  });
});
