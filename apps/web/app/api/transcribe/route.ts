import { NextResponse } from "next/server";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../lib/workspace-service";
import { getCurrencyUnitPlural } from "../../../lib/currencies";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

const OPENAI_WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions";

export async function POST(request: Request) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.ai);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { workspaceId, user } = ctx;

    // Check write permission (transcription creates data)
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      return NextResponse.json(
        { error: "Missing OpenAI API key configuration." },
        { status: 500 }
      );
    }

    const workspace = await getWorkspaceById(workspaceId);
    const currencyUnit = getCurrencyUnitPlural(workspace?.currency ?? "AUD");

    const formData = await request.formData();
    const audioFile = formData.get("audio") as Blob | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided." },
        { status: 400 }
      );
    }

    // Create form data for OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, "audio.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "en");
    whisperFormData.append("response_format", "json");
    // Add prompt to help with financial context
    whisperFormData.append(
      "prompt",
      `Transcribe this audio about cash expenses. Common items include groceries like eggs, rice, vegetables, meat, fruit. Amounts are in ${currencyUnit}. For example: eggs twenty ${currencyUnit}, rice fifteen ${currencyUnit}.`
    );

    const response = await fetch(OPENAI_WHISPER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`
      },
      body: whisperFormData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper API error:", errorText);
      return NextResponse.json(
        { error: "Failed to transcribe audio." },
        { status: 500 }
      );
    }

    const result = (await response.json()) as { text?: string };
    const transcribedText = result.text?.trim() ?? "";

    // Normalize spoken amounts to numerical format
    const normalizedText = normalizeSpokenAmounts(transcribedText);

    return NextResponse.json({ text: normalizedText });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error("Transcription failed:", error);
    return NextResponse.json(
      { error: "Failed to transcribe audio." },
      { status: 500 }
    );
  }
}

function normalizeSpokenAmounts(text: string): string {
  let normalized = text;

  // Map of spoken numbers to digits
  const numberWords: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
    hundred: 100
  };

  // Pattern: "twenty dollars and fifty cents" -> "$20.50"
  const dollarCentPattern =
    /(\w+(?:\s+\w+)?)\s+dollars?\s+(?:and\s+)?(\w+(?:\s+\w+)?)\s+cents?/gi;
  normalized = normalized.replace(dollarCentPattern, (match, dollarPart, centPart) => {
    const dollars = parseSpokenNumber(dollarPart, numberWords);
    const cents = parseSpokenNumber(centPart, numberWords);
    if (dollars !== null && cents !== null) {
      return `$${dollars}.${String(cents).padStart(2, "0")}`;
    }
    return match;
  });

  // Pattern: "twenty dollars" -> "$20"
  const dollarOnlyPattern = /(\w+(?:\s+\w+)?)\s+dollars?/gi;
  normalized = normalized.replace(dollarOnlyPattern, (match, dollarPart) => {
    const dollars = parseSpokenNumber(dollarPart, numberWords);
    if (dollars !== null) {
      return `$${dollars}`;
    }
    return match;
  });

  // Pattern: "fifteen bucks" -> "$15"
  const bucksPattern = /(\w+(?:\s+\w+)?)\s+bucks?/gi;
  normalized = normalized.replace(bucksPattern, (match, amountPart) => {
    const amount = parseSpokenNumber(amountPart, numberWords);
    if (amount !== null) {
      return `$${amount}`;
    }
    return match;
  });

  // Pattern: "$20 50" or "20.50" after spoken numbers
  const numericPattern = /\$?(\d+)\s+(\d{1,2})(?!\d)/g;
  normalized = normalized.replace(numericPattern, (match, dollars, cents) => {
    if (parseInt(cents) < 100) {
      return `$${dollars}.${cents.padStart(2, "0")}`;
    }
    return match;
  });

  return normalized;
}

function parseSpokenNumber(
  text: string,
  numberWords: Record<string, number>
): number | null {
  const words = text.toLowerCase().trim().split(/\s+/);
  let total = 0;
  let current = 0;

  for (const word of words) {
    const value = numberWords[word];
    if (value === undefined) {
      // Try parsing as digit
      const parsed = parseInt(word);
      if (!isNaN(parsed)) {
        current += parsed;
      } else {
        return null;
      }
    } else if (value === 100) {
      current = current === 0 ? 100 : current * 100;
    } else if (value >= 20) {
      current += value;
    } else {
      current += value;
    }
  }

  total += current;
  return total > 0 ? total : null;
}
