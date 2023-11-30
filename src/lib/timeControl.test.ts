import { describe, it, expect } from "vitest";
import { thinkingTime, timeRemaining } from "./useTimeControl";
import { TimeControl } from "./game";

describe("thinkingTime", () => {
  it("should correctly calculate thinking time for both players, including ongoing time", () => {
    const moveTimes = ["2023-01-01T10:00:00.000Z", "2023-01-01T10:05:00.000Z"];
    const currentTime = "2023-01-01T10:10:00.000Z"; // 5 minutes after the last move
    const result = thinkingTime(moveTimes, currentTime);

    expect(result.whiteThinkingTime).toBe(300000); // 5 minutes in milliseconds
    expect(result.blackThinkingTime).toBe(300000); // 5 minutes in milliseconds
  });

  it("calculates thinking time correctly for alternating moves", () => {
    const moveTimes = [
      "2023-11-23T10:00:00.000Z",
      "2023-11-23T10:00:30.000Z",
      "2023-11-23T10:01:00.000Z",
    ];
    const currentTime = "2023-11-23T10:01:30.000Z"; // Test current time
    const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);
    expect(whiteThinkingTime).toBe(30000);
    expect(blackThinkingTime).toBe(60000);
  });

  it("handles no moves with zero thinking time", () => {
    const moveTimes: string[] = [];
    const currentTime = "2023-11-23T10:00:00.000Z";
    const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);
    expect(whiteThinkingTime).toBe(0);
    expect(blackThinkingTime).toBe(0);
  });

  it("handles uneven number of moves", () => {
    const moveTimes = [
      "2023-11-23T10:00:00.000Z",
      "2023-11-23T10:00:20.000Z",
      "2023-11-23T10:00:50.000Z",
    ];
    const currentTime = "2023-11-23T10:01:10.000Z";
    const { whiteThinkingTime, blackThinkingTime } = thinkingTime(moveTimes, currentTime);
    expect(whiteThinkingTime).toBe(30000);
    expect(blackThinkingTime).toBe(40000);
  });
});

describe("timeRemaining", () => {
  it("should calculate remaining time correctly", () => {
    const moveTimes = ["2022-03-01T00:00:00Z", "2022-03-01T00:01:00Z", "2022-03-01T00:02:00Z"];
    const timeControl: TimeControl = { baseMinutes: 5, incrementSeconds: 3 };
    const currentTime = "2022-03-01T00:02:00Z";

    const result = timeRemaining(timeControl, moveTimes, currentTime);

    expect(result.whiteRemainingTime).toEqual(5 * 60 * 1000 - 60000 + 2 * 3000);
    expect(result.blackRemainingTime).toEqual(5 * 60 * 1000 - 60000 + 1 * 3000);
  });
});
