import Anthropic from "@anthropic-ai/sdk";

/**
 * Guided-interview bio composition. With ANTHROPIC_API_KEY configured the
 * answers are woven into prose by Claude; without a key — or on any API
 * error/refusal — a deterministic template fallback keeps the feature
 * working. The result is always a draft the user edits before publishing.
 */

export interface InterviewAnswer {
  question: string;
  answer: string;
}

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

export function composeBioFromTemplate(
  name: string,
  answers: InterviewAnswer[],
  lang: string,
): string {
  const parts = answers
    .filter((a) => a.answer.trim())
    .map((a) => a.answer.trim().replace(/\s+/g, " "));
  if (lang === "zh") {
    return parts.join("\n\n");
  }
  return parts.join("\n\n");
}

async function composeBioWithClaude(
  name: string,
  answers: InterviewAnswer[],
  lang: string,
): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  const zh = lang === "zh";
  const qa = answers
    .filter((a) => a.answer.trim())
    .map((a) => `Q: ${a.question}\nA: ${a.answer.trim()}`)
    .join("\n\n");

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: zh
        ? "你是一位帮助家属撰写纪念文字的写作者。根据家属对引导问题的回答，为逝者（或被纪念者）写一篇生平，用于线上纪念空间。要求：庄重、温暖、克制，不堆砌辞藻，不编造回答中没有的事实；以第三人称叙述；分为 2-4 个自然段，总长 150-400 字；直接输出正文，不要标题、前言或任何说明。"
        : "You help families write memorial text. From the family's answers to guided questions, write a life story for an online memorial. Requirements: solemn, warm and restrained; do not invent facts absent from the answers; third person; 2-4 paragraphs, 120-300 words total; output only the body text with no title, preamble or commentary.",
      messages: [
        {
          role: "user",
          content: zh
            ? `被纪念者的姓名：${name}\n\n家属的回答：\n\n${qa}`
            : `Name of the person: ${name}\n\nThe family's answers:\n\n${qa}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return null;
    const text = response.content
      .filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      )
      .map((b) => b.text)
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.warn("compose-bio: Claude API unavailable, using template:", err);
    return null;
  }
}

export async function composeBio(
  name: string,
  answers: InterviewAnswer[],
  lang: string,
): Promise<{ bio: string; source: "ai" | "template" }> {
  const ai = await composeBioWithClaude(name, answers, lang);
  if (ai) return { bio: ai, source: "ai" };
  return {
    bio: composeBioFromTemplate(name, answers, lang),
    source: "template",
  };
}
