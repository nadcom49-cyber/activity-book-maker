# Activity Book Maker

Plan, illustrate and export printable activity books for kids, with AI doing the writing and drawing. Each book comes with four store thumbnails, a ready-to-paste store listing, and series can be sold as bundles.

Inspired by https://yerobooks.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create a book from a trending topic, a cover you like, your own idea or a product link, with grade band, subject, language (English, French, Spanish), page size and up to 16 pages.
- Get ranked niche ideas from a keyword, start a book from one, or plan a series of 2 to 6 books.
- Have AI plan every page, then edit, reorder, add or remove pages.
- Draw each page and four square thumbnails one at a time or all at once, redraw with a note, or upload your own image.
- Flip through the finished book and download a PDF or a ZIP with every image, the PDF and the listing.
- Have AI write a store listing with title, description, grades, subjects, tags and price, then edit and copy each field.
- Bundle a series with its own listing and four images made from the books' covers and pages.

Left out: accounts and sign-in, which your Gateway handles; the browser extension; the sister design tools; live marketplace numbers and trademark checks; plans and billing; messages with a vendor team; a content calendar; a quality report file.

## Setup

```sh
pnpm install
pnpm dev          # run locally behind the EveryApp dev launcher
pnpm test         # unit tests
pnpm run deploy   # deploy to your Cloudflare account behind your Gateway
```

The app needs no secrets or settings. Writing and drawing use the Gateway's OpenRouter provider: add a key with `pnpm everyapp provider add openrouter` (https://openrouter.ai/settings/keys). Without it the app opens and works for hand-written pages and uploaded images; AI buttons say AI isn't set up. Locally, put `OPENROUTER_API_KEY` in `.dev.vars`.

The checks in `checks/` run against a packaged release with a local stand-in for the model; real model calls and a real deployment are not part of them.

## Limitations

- Pictures come from `google/gemini-2.5-flash-image` and text from `openai/gpt-4o-mini` on OpenRouter, billed to your key.
- PDFs use a standard font: pages without a picture print Latin characters only.
- Uploaded images are PNG or JPEG, 8 MB at most.
- Each book is private to the member who made it; admins can see and delete any member's books from the Admin page.
