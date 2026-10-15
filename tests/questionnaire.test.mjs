import assert from "node:assert/strict";
import test from "node:test";
import questions from "../src/app/questions.json" with { type: "json" };
import {
  buildRow,
  createPostHandler,
  validSubmission,
} from "../src/lib/questionnaire-handler.mjs";
import { syntheticSubmission } from "./fixture.mjs";

const env = {
  GOOGLE_SHEET_ID: "test-sheet",
  GOOGLE_SERVICE_ACCOUNT_EMAIL: "test@example.invalid",
  GOOGLE_PRIVATE_KEY: "line1\\nline2",
};
function setup(fail = false, config = env) {
  const calls = [];
  let credentials;
  const google = {
    auth: {
      GoogleAuth: class {
        constructor(options) {
          credentials = options;
        }
      },
    },
    sheets: () => ({
      spreadsheets: {
        values: {
          append: async (...args) => {
            calls.push(args);
            if (fail) throw new Error("private upstream error");
          },
        },
      },
    }),
  };
  return {
    handler: createPostHandler({ google, questions, env: config }),
    calls,
    auth: () => credentials,
  };
}
const request = (body) =>
  new Request("http://localhost/api/questionnaire", {
    method: "POST",
    body: JSON.stringify(body),
  });

test("invalid JSON and invalid shapes never call Google", async () => {
  const { handler, calls } = setup();
  assert.equal(
    (
      await handler(
        new Request("http://localhost", { method: "POST", body: "{" }),
      )
    ).status,
    400,
  );
  for (const body of [
    null,
    [],
    {},
    { answers: [] },
    { answers: {}, details: [] },
  ])
    assert.equal((await handler(request(body))).status, 400);
  assert.equal(calls.length, 0);
});
test("rejects unknown choices, invalid numbers, incompatible selections and missing Other details", () => {
  for (const change of [
    (p) => (p.answers[1] = "no"),
    (p) => (p.answers[4] = 169),
    (p) => (p.answers[6] = "UNKNOWN"),
    (p) => (p.answers[19] = "Je relis le cours"),
    (p) =>
      (p.answers[5] = [
        questions[4].options[0],
        "Aucune matière en particulier",
      ]),
    (p) => (p.answers[26] = ["Autre"]),
    (p) => (p.details[6] = {}),
  ]) {
    const payload = syntheticSubmission(questions);
    change(payload);
    assert.equal(validSubmission(payload, questions), false);
  }
});
test("serializes multiple answers and details into the stable 66-column schema", async () => {
  const { handler, calls, auth } = setup();
  const payload = syntheticSubmission(questions);
  payload.answers[26] = ["Faire des exercices", "Autre"];
  payload.details[26] = "Synthetic detail";
  const result = await handler(request(payload));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  const [params, options] = calls[0];
  const row = params.requestBody.values[0];
  assert.equal(row.length, 66);
  assert.equal(row[51], "Faire des exercices; Autre");
  assert.equal(row[52], "Synthetic detail");
  assert.equal(params.valueInputOption, "RAW");
  assert.equal(params.insertDataOption, "INSERT_ROWS");
  assert.equal(params.range, "'Responses'!A:BN");
  assert.equal(options.retry, false);
  assert.equal(auth().credentials.private_key, "line1\nline2");
});
test("no consent excludes stale contact but retains all normal answers including question 31", () => {
  const payload = syntheticSubmission(questions);
  const row = buildRow(payload, questions);
  assert.equal(row[61], "Non");
  assert.deepEqual(row.slice(-3), ["", "", ""]);
  assert.equal(row[1], "18");
});
test("consent includes contact and defaults the contact method", () => {
  const payload = syntheticSubmission(questions);
  payload.answers[31] = "Oui";
  delete payload.answers[32].method;
  assert.equal(validSubmission(payload, questions), true);
  assert.deepEqual(buildRow(payload, questions).slice(-3), [
    "Courriel",
    "INTEGRATION TEST",
    "test@example.invalid",
  ]);
});
test("optional comments and contact may be empty", () => {
  const payload = syntheticSubmission(questions);
  payload.answers[31] = "Oui";
  payload.answers[32] = "";
  delete payload.answers[30];
  assert.equal(validSubmission(payload, questions), true);
});
test("missing configuration returns 500 without a Google call", async () => {
  const { handler, calls } = setup(false, {});
  assert.equal(
    (await handler(request(syntheticSubmission(questions)))).status,
    500,
  );
  assert.equal(calls.length, 0);
});
test("upstream failure returns a safe 502", async () => {
  const { handler } = setup(true);
  const result = await handler(request(syntheticSubmission(questions)));
  assert.equal(result.status, 502);
  assert.deepEqual(await result.json(), {
    error: "Envoi impossible pour le moment. Réessaie.",
  });
});
