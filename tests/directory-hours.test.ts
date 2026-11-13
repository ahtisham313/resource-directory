import { expect, it } from "vitest";
import { officeStatus } from "../src/modules/resources/office-hours";

it("uses the provider's DST-aware time zone and handles overnight shifts across the week boundary", () => {
  const weekday = {
    startDay: "Monday",
    endDay: "Friday",
    startTime: "09:00",
    endTime: "17:00",
  };
  expect(
    officeStatus(weekday, "America/New_York", new Date("2026-07-06T13:00:00Z"))
      .openState,
  ).toBe("Open");
  expect(
    officeStatus(
      weekday,
      "America/Los_Angeles",
      new Date("2026-07-06T13:00:00Z"),
    ).openState,
  ).toBe("Closed");
  expect(
    officeStatus(weekday, "America/New_York", new Date("2026-11-02T13:59:00Z"))
      .openState,
  ).toBe("Closed");
  expect(
    officeStatus(weekday, "America/New_York", new Date("2026-11-02T14:00:00Z"))
      .openState,
  ).toBe("Open");
  expect(
    officeStatus(weekday, "America/New_York", new Date("2026-11-02T22:00:00Z"))
      .openState,
  ).toBe("Closed");
  const overnight = {
    startDay: "Friday",
    endDay: "Saturday",
    startTime: "22:00",
    endTime: "02:00",
  };
  expect(
    officeStatus(overnight, "UTC", new Date("2026-11-15T01:00:00Z")).openState,
  ).toBe("Open");
  expect(
    officeStatus(overnight, "UTC", new Date("2026-11-15T02:00:00Z")).openState,
  ).toBe("Closed");
  const wrap = { ...weekday, startDay: "Friday", endDay: "Monday" };
  expect(
    officeStatus(wrap, "UTC", new Date("2026-11-15T12:00:00Z")).openState,
  ).toBe("Open");
  expect(
    officeStatus(wrap, "UTC", new Date("2026-11-17T12:00:00Z")).openState,
  ).toBe("Closed");
  for (const [hours, zone] of [
    [{}, "UTC"],
    [weekday, "Invalid/Zone"],
    [{ ...weekday, endTime: "09:00" }, "UTC"],
  ] as const)
    expect(officeStatus(hours, zone, new Date()).openState).toBe(
      "Hours unavailable",
    );
});
