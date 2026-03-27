import { describe, it, expect } from "vitest";
import { shallowArrayEqual } from "./shallow-equal";

describe("shallowArrayEqual", () => {
  it("returns true for same reference", () => {
    const arr = [1, 2, 3];
    expect(shallowArrayEqual(arr, arr)).toBe(true);
  });

  it("returns true for arrays with same contents", () => {
    expect(shallowArrayEqual([1, 2, 3], [1, 2, 3])).toBe(true);
  });

  it("returns true for two empty arrays", () => {
    expect(shallowArrayEqual([], [])).toBe(true);
  });

  it("returns false for different lengths", () => {
    expect(shallowArrayEqual([1, 2], [1, 2, 3])).toBe(false);
  });

  it("returns false for different elements", () => {
    expect(shallowArrayEqual([1, 2, 3], [1, 9, 3])).toBe(false);
  });

  it("uses strict equality (not deep)", () => {
    const obj = { x: 1 };
    const copy = { x: 1 };
    expect(shallowArrayEqual([obj], [obj])).toBe(true);
    expect(shallowArrayEqual([obj], [copy])).toBe(false);
  });
});
