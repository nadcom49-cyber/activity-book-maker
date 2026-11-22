import { env } from "cloudflare:workers";
import {
  aiBaseUrl,
  createGatewayFetch,
  gatewayRefusal,
  refusalFromError,
} from "@every-app/sdk/server";

const TEXT_MODEL = "openai/gpt-4o-mini";
const IMAGE_MODEL = "google/gemini-2.5-flash-image";

/** A model call that didn't give a usable answer; its message is shown as is. */
export class AiError extends Error {}

const NOT_SET_UP =
  "AI isn't set up yet. An admin adds an OpenRouter key in the Gateway.";

async function complete(body: Record<string, unknown>) {
  let response: Response;
  try {
    const gatewayFetch = createGatewayFetch({ env });
    response = await gatewayFetch(
      `${aiBaseUrl("openrouter")}/chat/completions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
  } catch (error) {
    if (refusalFromError(error)) throw new AiError(NOT_SET_UP);
    throw error;
  }
  if (!response.ok) {
    const refusal = await gatewayRefusal(response.clone());
    if (refusal) {
      if (/not_configured|not_allowed/.test(refusal.code))
        throw new AiError(NOT_SET_UP);
      throw new AiError(refusal.message);
    }
    throw new AiError(`The model call failed (${response.status}). Try again.`);
  }
  const json = (await response.json()) as {
    choices?: {
      message?: {
        content?: string | null;
        images?: { image_url?: { url?: string } }[];
      };
    }[];
  };
  const message = json.choices?.[0]?.message;
  if (!message) throw new AiError("The model sent no answer. Try again.");
  return message;
}

/** Asks the text model for a JSON object. `task` names the job on the prompt's first line. */
export async function askJson<T>(
  task: string,
  instructions: string,
  input: Record<string, unknown>,
): Promise<T> {
  const message = await complete({
    model: TEXT_MODEL,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Task: ${task}\n${instructions}\nAnswer with one JSON object only.`,
      },
      { role: "user", content: JSON.stringify(input) },
    ],
  });
  const content = (message.content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") throw new Error("not an object");
    return parsed as T;
  } catch {
    throw new AiError("The model's answer couldn't be read. Try again.");
  }
}

/** Draws one picture and returns its bytes and type. */
export async function drawImage(
  prompt: string,
  aspectRatio: "3:4" | "1:1",
): Promise<{ bytes: Uint8Array; type: string }> {
  const message = await complete({
    model: IMAGE_MODEL,
    modalities: ["image", "text"],
    image_config: { aspect_ratio: aspectRatio },
    messages: [{ role: "user", content: prompt }],
  });
  const url = message.images?.[0]?.image_url?.url ?? "";
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(url);
  if (!match) throw new AiError("The model sent no picture. Try again.");
  return { type: match[1]!, bytes: fromBase64(match[2]!) };
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
