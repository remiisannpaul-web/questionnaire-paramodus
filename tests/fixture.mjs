export function syntheticSubmission(questions) {
  const answers = {};
  for (const question of questions) {
    answers[question.id] =
      question.kind === "number"
        ? "18"
        : question.kind === "text"
          ? "INTEGRATION TEST — synthetic response"
          : question.kind === "contact"
            ? {
                name: "INTEGRATION TEST",
                address: "test@example.invalid",
                method: "Courriel",
              }
            : question.kind === "multi"
              ? [question.options[0]]
              : question.options[0];
  }
  answers[31] = "Non";
  return { answers, details: {} };
}
