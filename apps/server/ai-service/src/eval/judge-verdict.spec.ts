import { parseJudgeVerdict } from "./judge-verdict";

describe("parseJudgeVerdict", () => {
  it("reads a clean JSON verdict", () => {
    expect(
      parseJudgeVerdict('{"pass": true, "reason": "Correct and concise"}'),
    ).toEqual({
      pass: true,
      reason: "Correct and concise",
    });
  });

  it("reads a verdict wrapped in a code fence or surrounded by text", () => {
    expect(
      parseJudgeVerdict(
        'Here you go:\n```json\n{"pass": false, "reason": "Adds a paid plan"}\n```',
      ),
    ).toEqual({ pass: false, reason: "Adds a paid plan" });
  });

  it("keeps the verdict when the reason breaks the JSON (unescaped quotes)", () => {
    // The rag-2 failure seen in CI: valid "pass", invalid JSON overall.
    const raw =
      '{"pass": false, "reason": "Answer states 500 but calls it "the free tier""}';
    expect(parseJudgeVerdict(raw)).toEqual({
      pass: false,
      reason: 'Answer states 500 but calls it "the free tier"',
    });
  });

  it("keeps the verdict of a reply cut off mid-reason", () => {
    expect(
      parseJudgeVerdict(
        '{"pass": true, "reason": "States exactly 500 messages and cites',
      ),
    ).toEqual({
      pass: true,
      reason: "States exactly 500 messages and cites",
    });
  });

  it("gives up (null) when there is no verdict at all", () => {
    expect(parseJudgeVerdict("I cannot grade this.")).toBeNull();
    expect(parseJudgeVerdict('{"reason": "no pass field"}')).toBeNull();
    expect(parseJudgeVerdict("")).toBeNull();
  });
});
