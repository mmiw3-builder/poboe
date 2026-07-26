import { describe, expect, it } from "vitest";
import { checkTextLocal, moderateText } from "./text";

describe("checkTextLocal", () => {
  it("passes ordinary memorial text, including death-related language", () => {
    const v = checkTextLocal(
      "先父抗战老兵，一生正直。1943年负伤，2020年病逝于北京。愿在天堂安息。",
    );
    expect(v.ok).toBe(true);
  });

  it("blocks listed terms", () => {
    expect(checkTextLocal("低价代开发票联系我").ok).toBe(false);
  });

  it("flags link farms but allows a couple of links", () => {
    expect(checkTextLocal("他的作品 https://a.com 和 https://b.com").ok).toBe(true);
    expect(
      checkTextLocal(
        "https://a.com https://b.com https://c.com https://d.com https://e.com",
      ).ok,
    ).toBe(false);
  });

  it("flags repetition spam", () => {
    expect(checkTextLocal("啊".repeat(60)).ok).toBe(false);
  });
});

describe("moderateText", () => {
  it("combines fields and skips empty input", async () => {
    expect((await moderateText([undefined, "", "  "])).ok).toBe(true);
    expect((await moderateText(["正常内容", "办证刻章"])).ok).toBe(false);
  });
});
