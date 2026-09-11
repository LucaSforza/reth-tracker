import { describe, expect, it } from "vitest";
import { formatPercentage, formatUnits, formatWei } from "./format";

describe("raw amount formatting", () => {
  it("formats large wei values without Number conversion", () => {
    expect(formatWei("123456789012345678901234567890", 4)).toBe("123456789012.3456");
    expect(formatUnits("1000001", 6, 6)).toBe("1.000001");
  });

  it("trims insignificant zeroes and formats signed rewards", () => {
    expect(formatWei("-100000000000000000", 3)).toBe("-0.1");
    expect(formatUnits("1000000000000000000", 18, 2)).toBe("1");
  });

  it("calculates percentages using integer arithmetic", () => {
    expect(formatPercentage("1", "3", 2)).toBe("33.33%");
    expect(formatPercentage("0", "0")).toBe("—");
  });
});
