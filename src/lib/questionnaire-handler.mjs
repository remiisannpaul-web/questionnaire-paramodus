function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toText(value) {
  if (Array.isArray(value)) return value.map(toText).join("; ");
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

// Validate the same answer types, options and exclusions used by the form.
export function validSubmission(body, questions) {
  if (!isRecord(body) || !isRecord(body.answers)) return false;
  const { answers, details = {} } = body;
  if (
    !isRecord(details) ||
    Object.values(details).some(
      (v) => typeof v !== "string" || v.length > 10000,
    )
  )
    return false;

  return questions.every((question) => {
    const value = answers[question.id];
    if (question.kind === "contact") {
      // Ignore stale contact data when consent is absent.
      if (answers[31] !== "Oui" || value === undefined || value === "")
        return true;
      return (
        isRecord(value) &&
        ["name", "address", "method"].every(
          (key) =>
            value[key] === undefined ||
            (typeof value[key] === "string" && value[key].length <= 10000),
        ) &&
        (value.method === undefined ||
          ["Courriel", "Téléphone", "Réseau social"].includes(value.method))
      );
    }
    if (question.kind === "text")
      return (
        value === undefined ||
        (typeof value === "string" && value.length <= 10000)
      );
    if (question.kind === "number")
      return (
        (typeof value === "number" || typeof value === "string") &&
        String(value).trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0 &&
        Number(value) <= (question.id === 1 ? 120 : 168)
      );
    if (question.kind === "multi") {
      if (
        !Array.isArray(value) ||
        !value.length ||
        new Set(value).size !== value.length ||
        value.some((option) => !question.options.includes(option))
      )
        return false;
      const exclusive = (option) =>
        question.exclusiveOptions?.includes(option) ||
        option.startsWith("Aucun") ||
        option === "Je ne sais pas" ||
        option === "Je préfère ne pas répondre";
      if (value.length > 1 && value.some(exclusive)) return false;
    } else if (!question.options.includes(value)) return false;
    const other = Array.isArray(value)
      ? value.some((option) => option.startsWith("Autre"))
      : value.startsWith("Autre");
    return !other || Boolean(details[question.id]?.trim());
  });
}

export function buildRow({ answers, details = {} }, questions) {
  const row = [new Date().toISOString()];
  for (const question of questions) {
    if (question.kind === "contact") {
      const contact =
        answers[31] === "Oui" && isRecord(answers[question.id])
          ? answers[question.id]
          : {};
      row.push(
        contact.name || contact.address
          ? toText(contact.method || "Courriel")
          : "",
        toText(contact.name),
        toText(contact.address),
      );
    } else {
      row.push(toText(answers[question.id]), toText(details[question.id]));
    }
  }
  return row;
}

// Dependencies are injectable so API behavior can be checked without Google writes.
export function createPostHandler({ google, questions, env = process.env }) {
  return async function POST(request) {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Données invalides." }, { status: 400 });
    }
    if (!validSubmission(body, questions))
      return Response.json(
        { error: "Réponses invalides ou incomplètes." },
        { status: 400 },
      );
    if (
      !env.GOOGLE_SHEET_ID ||
      !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
      !env.GOOGLE_PRIVATE_KEY
    )
      return Response.json(
        { error: "La connexion au questionnaire n’est pas configurée." },
        { status: 500 },
      );
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
          private_key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      const sheets = google.sheets({ version: "v4", auth });
      const tab = (env.GOOGLE_SHEET_TAB || "Responses").replace(/'/g, "''");
      await sheets.spreadsheets.values.append(
        {
          spreadsheetId: env.GOOGLE_SHEET_ID,
          range: `'${tab}'!A:BN`,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values: [buildRow(body, questions)] },
        },
        { timeout: 15000, retry: false },
      );
      return Response.json({ ok: true });
    } catch {
      // Do not expose credentials, survey responses or upstream errors to clients.
      return Response.json(
        { error: "Envoi impossible pour le moment. Réessaie." },
        { status: 502 },
      );
    }
  };
}
