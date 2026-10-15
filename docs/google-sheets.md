# Google Sheets integration

Verification date: 2026-10-14.

## Result

The integration successfully authenticated with the configured service account,
appended synthetic questionnaire submissions, and read the stored cells back from
Google Sheets. Both contact consent paths (`Oui` and `Non`) passed across all 66
columns. Tests used a newly created temporary tab, which was deleted afterward.
No real respondent rows were added, changed or deleted.

The existing tab is named `responses`. Google successfully resolves the default
`'Responses'` A1 range to that tab. It already has 66 populated header cells; no
new production tab or headers were needed. An initial attempt to create a
capitalized `Responses` tab was rejected by Google because names are
case-insensitive. The verification script now accounts for that.

## Flow and column order

1. The browser sends `{ answers, details }` to `POST /api/questionnaire` only when
   the user finishes on question 31 (`Non`) or question 32 (`Oui`).
2. The server validates answer types, numeric bounds, allowed options, multiple
   choice exclusions and required `Autre` details before contacting Google.
3. The server appends one row with `valueInputOption: RAW` and
   `insertDataOption: INSERT_ROWS`, following the Google API contract:
   https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append
4. The browser shows completion only after receiving `{ ok: true }`.

There are 66 columns (`A:BN`):

- Column A: server receipt timestamp in UTC (ISO 8601).
- Columns B:BK: questions 1–31, two columns each: answer and detail.
- Columns BL:BN: contact method, name/pseudonym, contact address.

Multiple selections are serialized with `; ` between options. Missing optional
values are empty cells. Question 31 is always retained as an ordinary answer.
Contact cells remain blank unless question 31 is exactly `Oui`, even if stale
contact values are present in the request. Missing contact method defaults to
`Courriel` when contact information exists.

## Changes made

- Moved the API logic to `src/lib/questionnaire-handler.mjs` with injectable Google
  and environment dependencies; the Next.js route remains a small adapter.
- Added server-side validation rather than accepting any object as survey data.
- Removed `export const runtime = "nodejs"` from the route: this declaration
  caused a build failure with the project's `cacheComponents` configuration.
  The route uses the default Node.js runtime.
- Added optional `GOOGLE_SHEET_TAB` (default `Responses`) and expanded the append
  lookup range to the complete `A:BN` table.
- Set a 15-second append timeout and disabled automatic retries for that call.
- Renamed the browser helper to `sendToGoogleSheets`, checked the success payload,
  displayed server errors with `role="alert"`, and disabled navigation/submission
  buttons during a send. Corrected the success text that said nothing was sent.
- Added eight automated tests and an isolated live verification script.

## Configuration

Use `.env.local` locally and server-side environment variables on your host:

```dotenv
GOOGLE_SHEET_ID=your_spreadsheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
# Optional; set this to the desired tab name:
GOOGLE_SHEET_TAB=Responses
```

Enable the Google Sheets API in the service account's Google Cloud project and
share the spreadsheet with the service account email as an editor. Keep these
variables on the server; do not use a `NEXT_PUBLIC_` prefix. `.env*` is ignored by
Git. Restart the application after changing environment variables.

The target tab must exist and have the 66-column header row before collecting
responses. Generate headers from the project root (`questionnaire/`):

```bash
node -e 'const qs=require("./src/app/questions.json"); console.log(["Date",...qs.flatMap(q=>q.kind==="contact"?["Moyen de contact","Nom","Coordonnée"]:[q.title,`Précision — ${q.title}`])].join("\t"))'
```

Paste into A1. Do not reorder these columns independently of the question schema.

## Verification commands

```bash
npm test
npm run build
npm run test:sheets:live
```

`npm test` makes no network requests. The live command uses real credentials,
checks the target tab, creates a temporary `_integration_test_...` tab, appends
two synthetic submissions, verifies every stored cell, then deletes only that
temporary tab in a `finally` block. The script never prints credential values or
respondent data. If cleanup fails, it reports that the test tab needs removal.

For a new spreadsheet without a target tab, this explicit command creates it
with headers before testing:

```bash
npm run test:sheets:live -- --prepare
```

Verified in this session:

- Eight automated tests passed: malformed input, answer validation, schema and
  serialization, consent exclusion/inclusion, optional fields, missing config,
  and upstream failure handling.
- Live authentication, production range/header access, append and read-back
  succeeded. Temporary test tab cleanup succeeded.
- Production build passed and included the dynamic `/api/questionnaire` route.
- Production HTTP smoke checks on temporary port 3001 returned 200 for the page
  and 400 for malformed JSON, invalid shapes and incomplete answers. The temporary
  server was stopped. Port 3000 was not restarted.

Browser interaction was not verified because no connected browser is available.
The live write test exercises the same handler as the Next.js route, but targets
an isolated tab rather than inserting test respondents into the production tab.

## Error behavior and limits

- `400`: malformed JSON or invalid/incomplete answers.
- `500`: missing server configuration.
- `502`: Google authentication or append failure. The browser stays on the final
  question, retains the answers and permits a retry.

Automatic append retries are disabled to reduce duplicate writes. Google append
is not idempotent: if Google stores a row but the response is lost, a manual retry
can still create a duplicate. No persistent deduplication or submission ID store
has been added. The endpoint is publicly callable and this verification does not
constitute load testing or an abuse-prevention audit.
