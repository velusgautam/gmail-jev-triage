# gmail-jev-triage

Reads your Gmail inbox, asks the [Jev API](https://beatapi.io/jev-api) which category each email belongs in, and labels it in Gmail. It is a dry run unless you pass `--apply`, and it never deletes anything (it only asks for the `gmail.modify` scope).

Code for the blog post: **[add post URL]**

## Setup

1. Create a Google Cloud project, enable the Gmail API, and create a **Desktop app** OAuth client. Save the download as `credentials.json` here. Add your own address as a test user on the consent screen.
2. Get a BeatAPI key at https://beatapi.io/dashboard/apikeys.
3. `cp .env.example .env` and fill in `BEATAPI_API_KEY`.
4. `npm install`

## Run

```bash
npm start              # dry run: classify, print, write results.csv
npm start -- --apply   # create labels and apply them in Gmail
```

The first run prints a login URL; approve it and `token.json` is saved.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `JEV_MODEL` | `jev-1.13` | `jev-1.13-free` for the free tier |
| `CONCURRENCY` | `5` | Emails classified at once |
| `REQUEST_DELAY_MS` | `0` | Minimum gap between request starts. Use `61000` with `CONCURRENCY=1` on the free tier |
| `LABEL_PREFIX` | `AI` | Parent label, e.g. `AI/Fraud` |
| `GMAIL_QUERY` | `in:inbox -is:important` | Any Gmail search |
| `MAX_MESSAGES` | `100` | Cap per run |

`src/trash.ts` moves messages to Trash with an undo list. It is not wired into the CLI on purpose; read the post's guard rails before using it.

## Status

The Jev calls and the free-tier throttle were tested. The Gmail parts follow the standard Gmail API but have not been run end to end from this repo, so start with a dry run on a small `MAX_MESSAGES`.
