import assert from "node:assert/strict";
import fs from "node:fs";
import dotenv from "dotenv";
import { google } from "googleapis";
import questions from "../src/app/questions.json" with { type: "json" };
import {
  buildRow,
  createPostHandler,
} from "../src/lib/questionnaire-handler.mjs";
import { syntheticSubmission } from "../tests/fixture.mjs";

const local = fs.existsSync(".env.local")
  ? dotenv.parse(fs.readFileSync(".env.local"))
  : {};
const env = { ...local, ...process.env };
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = env.GOOGLE_SHEET_ID;
const headers = [
  "Date",
  ...questions.flatMap((q) =>
    q.kind === "contact"
      ? ["Moyen de contact", "Nom", "Coordonnée"]
      : [q.title, `Précision — ${q.title}`],
  ),
];
let temporaryId;
try {
  const { data } = await sheets.spreadsheets.get(
    {
      spreadsheetId,
      fields: "sheets(properties(sheetId,title,gridProperties))",
    },
    { timeout: 15000 },
  );
  console.log("PASS: live Google authentication and spreadsheet access");
  const target = env.GOOGLE_SHEET_TAB || "Responses";
  const existing = data.sheets.find(
    (s) => s.properties.title.toLowerCase() === target.toLowerCase(),
  );
  if (!existing && process.argv.includes("--prepare")) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: target,
                gridProperties: { columnCount: headers.length },
              },
            },
          },
        ],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${target.replace(/'/g, "''")}'!A1:BN1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    console.log(
      "PREPARED: missing response tab and 66 column headers (existing tabs unchanged)",
    );
  } else if (!existing)
    throw new Error("Missing response tab; run with --prepare to create it.");
  else console.log("PASS: configured response tab exists");

  const title = `_integration_test_${Date.now()}`;
  const { data: added } = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title,
              gridProperties: { columnCount: headers.length },
            },
          },
        },
      ],
    },
  });
  temporaryId = added.replies[0].addSheet.properties.sheetId;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${title}'!A1:BN1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
  const handler = createPostHandler({
    google,
    questions,
    env: { ...env, GOOGLE_SHEET_TAB: title },
  });
  for (const consent of ["Non", "Oui"]) {
    const payload = syntheticSubmission(questions);
    payload.answers[31] = consent;
    const result = await handler(
      new Request("http://localhost/api/questionnaire", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    assert.equal(result.status, 200, "Live append must succeed");
    assert.deepEqual(await result.json(), { ok: true });
    const rowIndex = consent === "Non" ? 2 : 3;
    const { data: read } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${title}'!A${rowIndex}:BN${rowIndex}`,
    });
    const actual = read.values?.[0] || [];
    const expected = buildRow(payload, questions);
    assert.ok(!Number.isNaN(Date.parse(actual[0])));
    assert.deepEqual(
      Array.from(
        { length: expected.length - 1 },
        (_, i) => actual[i + 1] ?? "",
      ),
      expected.slice(1),
    );
    console.log(
      `PASS: actual append/read-back of all 66 columns, contact consent ${consent}`,
    );
  }
} catch (error) {
  console.error(
    "FAIL:",
    error.response
      ? `Google HTTP ${error.response.status}; ${error.response.data?.error?.status || "request failed"}`
      : error.code || error.message,
  );
  process.exitCode = 1;
} finally {
  if (temporaryId !== undefined) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ deleteSheet: { sheetId: temporaryId } }] },
      });
      console.log("CLEANED: temporary synthetic-test tab removed");
    } catch {
      console.error(
        "Cleanup failed: remove the _integration_test_ tab manually.",
      );
      process.exitCode = 1;
    }
  }
}
