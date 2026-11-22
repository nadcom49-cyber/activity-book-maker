import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "activity-book-maker",
  name: "Activity Book Maker",
  description:
    "Plan, illustrate and export printable activity books for kids, with store listings and series bundles.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
  providers: [
    {
      id: "openrouter",
      why: "Writes niche ideas, page plans and listings, and draws the pages and thumbnails.",
      docs: "https://openrouter.ai/settings/keys",
    },
  ],
  ai: {
    models: ["openai/gpt-4o-mini", "google/gemini-2.5-flash-image"],
  },
  features: {
    ai: {
      name: "AI writing and drawing",
      why: "Suggests niches, plans pages, draws illustrations and writes listings.",
      steps: ["Add an OpenRouter key: https://openrouter.ai/settings/keys"],
      providers: ["openrouter"],
    },
  },
});
