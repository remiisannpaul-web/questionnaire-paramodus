"use client";

import { useState } from "react";
import questions from "./questions.json";

const sections = [
  "Ta situation scolaire",
  "Comprendre ton travail",
  "Ton organisation",
  "L’aide que tu reçois",
  "Ton expérience",
  "Tes méthodes et besoins",
  "Tes besoins particuliers",
  "Pour aller plus loin",
];

export default function Home() {
  // État du parcours et réponses saisies par l’élève.
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  async function sendToGoogleSheets(currentAnswers, currentDetails) {
    const response = await fetch("/api/questionnaire", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: currentAnswers,
        details: currentDetails,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true) {
      throw new Error(
        result?.error || "Impossible d’envoyer tes réponses. Réessaie.",
      );
    }
  }
  // Question affichée et validation de sa réponse.
  const q = questions[index];
  const value = answers[q.id] ?? (q.kind === "multi" ? [] : "");
  const filled =
    q.kind === "multi"
      ? value.length > 0
      : q.kind === "contact"
        ? Boolean(value.name?.trim() && value.address?.trim())
        : String(value).trim().length > 0;
  const other =
    q.kind === "multi"
      ? value.some((v) => v.startsWith("Autre"))
      : typeof value === "string" && value.startsWith("Autre");
  const valid =
    (q.id === 30 || q.id === 32 || filled) &&
    (!other || Boolean(details[q.id]?.trim()));

  // Repère les questions qui utilisent l’échelle de fréquence à cinq niveaux.
  const frequencyScale =
    q.options.length === 6 &&
    ["Jamais", "Rarement", "Parfois", "Souvent", "Toujours"].every(
      (option, i) => q.options[i] === option,
    );

  // Sélectionne une réponse et gère les choix multiples exclusifs.
  function choose(option) {
    if (q.kind !== "multi") {
      setAnswers({ ...answers, [q.id]: option });
      return;
    }
    const exclusive = (v) =>
      q.exclusiveOptions?.includes(v) ||
      v.startsWith("Aucun") ||
      v === "Je ne sais pas" ||
      v === "Je préfère ne pas répondre";
    let next = value.includes(option)
      ? value.filter((v) => v !== option)
      : exclusive(option)
        ? [option]
        : [...value.filter((v) => !exclusive(v)), option];
    setAnswers({ ...answers, [q.id]: next });
  }

  // Passe à la question suivante ou affiche la page de fin.
  async function advance() {
    if (sending) return;

    const finished =
      index === questions.length - 1 || (q.id === 31 && value !== "Oui");

    if (!finished) {
      setIndex(index + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSending(true);
    setSendError("");

    try {
      await sendToGoogleSheets({ ...answers, [q.id]: value }, details);
      setDone(true);
    } catch (error) {
      setSendError(error.message);
    } finally {
      setSending(false);
    }
  }

  // Exporte les réponses dans un fichier JSON, sans envoi à un serveur.
  function download() {
    const data = {
      date: new Date().toISOString(),
      responses: questions
        .filter(
          (x) =>
            answers[x.id] !== undefined &&
            (x.id !== 32 || answers[31] === "Oui"),
        )
        .map((x) => ({
          question: x.title,
          reponse:
            x.kind === "contact"
              ? { method: "Courriel", ...answers[x.id] }
              : answers[x.id],
          precision: details[x.id] || undefined,
        })),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "mes-reponses.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Présente le projet et les consignes avant la première question.
  if (!started) {
    return (
      <div className="app intro-app">
        <div className="workspace intro-workspace">
          <main className="main intro-main">
            <div className="intro-page">
              <div className="intro-content">
                <div className="intro-hero">
                  <span className="intro-symbol" aria-hidden="true">
                    <svg
                      width="27"
                      height="27"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="5" y="3" width="15" height="18" rx="3" />
                      <path d="M9 3v18M12 8h4M12 12h4M12 16h2M3 7h4M3 12h4M3 17h4" />
                    </svg>
                  </span>
                  <p className="intro-eyebrow">
                    HABITUDES D’ÉTUDE · EXPÉRIENCE SCOLAIRE
                  </p>
                  <h1>
                    Pour mieux t’aider,
                    <br />
                    <span>commençons par t’écouter.</span>
                  </h1>
                  <p className="intro-description">
                    Tes habitudes, tes défis, tes idées. Partage ce que tu vis
                    pour nous aider à créer une application d’aide aux études
                    adaptée aux élèves.
                  </p>
                </div>

                <section
                  className="intro-guide"
                  aria-labelledby="intro-guide-title"
                >
                  <h2 id="intro-guide-title">
                    Quelques repères avant de commencer
                  </h2>
                  <div className="intro-cards">
                    <article className="intro-card">
                      <div className="intro-card-top">
                        <span className="intro-card-icon" aria-hidden="true">
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="5" width="18" height="16" rx="3" />
                            <path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2" />
                          </svg>
                        </span>
                        <span className="intro-card-number" aria-hidden="true">
                          01
                        </span>
                      </div>
                      <h3>Les deux dernières semaines</h3>
                      <p>
                        Pense à cette période pour décrire tes habitudes et tes
                        difficultés.
                      </p>
                    </article>
                    <article className="intro-card">
                      <div className="intro-card-top">
                        <span className="intro-card-icon" aria-hidden="true">
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z" />
                            <path d="M8 10h8M8 14h5" />
                          </svg>
                        </span>
                        <span className="intro-card-number" aria-hidden="true">
                          02
                        </span>
                      </div>
                      <h3>Ton expérience, tout simplement</h3>
                      <p>
                        Il n’y a pas de bonne ou de mauvaise réponse. Réponds
                        comme tu le ressens.
                      </p>
                    </article>
                    <article className="intro-card">
                      <div className="intro-card-top">
                        <span className="intro-card-icon" aria-hidden="true">
                          <svg
                            width="22"
                            height="22"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect x="3" y="4" width="7" height="7" rx="2" />
                            <path d="m5 7 1 1 2-2M14 7h7" />
                            <rect x="3" y="15" width="7" height="7" rx="2" />
                            <path d="M14 18h7" />
                          </svg>
                        </span>
                        <span className="intro-card-number" aria-hidden="true">
                          03
                        </span>
                      </div>
                      <h3>Une question à la fois</h3>
                      <p>
                        Choisis une réponse, ou plusieurs lorsque la consigne le
                        permet.
                      </p>
                    </article>
                  </div>
                </section>

                <div className="intro-launch">
                  <button
                    className="continue intro-start"
                    onClick={() => {
                      setStarted(true);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Commencer le questionnaire <span aria-hidden="true">→</span>
                  </button>
                  <p className="intro-caption">
                    Prends ton temps. Chaque réponse compte.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // Affiche le questionnaire ou le récapitulatif de fin.
  return (
    <div className="app">
      <div className="workspace">
        <main className="main">
          {done ? (
            <div className="completion">
              <div className="completion-check" aria-hidden="true">
                ✓
              </div>
              <span className="eyebrow">PARCOURS TERMINÉ</span>
              <h1>Merci pour ta participation.</h1>
              <p>
                Tes réponses contribuent à concevoir une application mieux
                adaptée aux besoins des élèves.
              </p>
              <div className="finish-note">
                Tes réponses ont bien été envoyées. Tu peux également en
                conserver une copie en les téléchargeant.
              </div>
              <button className="continue" onClick={download}>
                Télécharger mes réponses <span>↓</span>
              </button>
              <button
                className="text-button"
                onClick={() => {
                  setDone(false);
                  setIndex(0);
                }}
              >
                Relire mes réponses
              </button>
            </div>
          ) : (
            <>
              <div className="progress-row">
                <button
                  className="back"
                  onClick={() => index > 0 && setIndex(index - 1)}
                  disabled={index === 0 || sending}
                  aria-label="Question précédente"
                >
                  ←
                </button>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={index}
                  aria-valuemin={0}
                  aria-valuemax={questions.length}
                  aria-label="Progression"
                >
                  <div
                    style={{ width: `${(index / questions.length) * 100}%` }}
                  />
                </div>
                <span className="progress-count">
                  {index + 1}
                  <span> / {questions.length}</span>
                </span>
              </div>
              <div className="main-content" key={q.id}>
                <div className="question-meta">
                  <span className="eyebrow">{sections[q.section]}</span>
                  <span className="optional">
                    {q.id >= 28 ? "Facultatif" : "À ton rythme"}
                  </span>
                </div>
                <div className="question-heading">
                  <span className="question-label">
                    QUESTION {String(q.id).padStart(2, "0")}
                  </span>
                  <h1>{q.title}</h1>
                  <p>
                    {q.id === 1
                      ? "Un petit détail pour mieux comprendre ton parcours."
                      : q.note ||
                        (q.kind === "multi"
                          ? "Tu peux choisir plusieurs réponses."
                          : "Choisis la réponse qui te correspond le mieux.")}
                  </p>
                </div>
                {q.section === 6 && (
                  <p className="privacy-note">
                    Ces questions ne constituent pas une évaluation et ne
                    permettent pas de poser un diagnostic.
                  </p>
                )}
                <div className="answer-area">
                  {q.kind === "number" ? (
                    <>
                      <label className="input-label" htmlFor="number-answer">
                        {q.id === 1 ? "Ton âge" : "Heures par semaine"}
                      </label>
                      <div className="number-input">
                        <input
                          id="number-answer"
                          type="number"
                          min="0"
                          max={q.id === 1 ? 120 : 168}
                          placeholder={q.id === 1 ? "Ex. 16" : "Ex. 0"}
                          value={value}
                          onChange={(e) =>
                            setAnswers({ ...answers, [q.id]: e.target.value })
                          }
                        />
                        <span>{q.id === 1 ? "ans" : "heures"}</span>
                      </div>
                      <div className="input-hint">
                        <span>ⓘ</span>{" "}
                        {q.id === 1
                          ? "Indique ton âge en années."
                          : "Inscris 0 si tu n’as pas ces responsabilités."}
                      </div>
                    </>
                  ) : q.kind === "text" ? (
                    <textarea
                      aria-label="Ton commentaire"
                      placeholder="Ton expérience, une idée… on t’écoute."
                      value={value}
                      onChange={(e) =>
                        setAnswers({ ...answers, [q.id]: e.target.value })
                      }
                    />
                  ) : q.kind === "contact" ? (
                    <div className="contact">
                      <label>
                        Ton prénom ou pseudonyme
                        <input
                          value={value.name || ""}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [q.id]: { ...value, name: e.target.value },
                            })
                          }
                        />
                      </label>
                      <label>
                        Moyen de contact
                        <select
                          value={value.method || "Courriel"}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [q.id]: { ...value, method: e.target.value },
                            })
                          }
                        >
                          <option>Courriel</option>
                          <option>Téléphone</option>
                          <option>Réseau social</option>
                        </select>
                      </label>
                      <label>
                        Ta coordonnée
                        <input
                          value={value.address || ""}
                          onChange={(e) =>
                            setAnswers({
                              ...answers,
                              [q.id]: { ...value, address: e.target.value },
                            })
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <div
                      className={`options ${frequencyScale ? "options-frequency options-frequency-extra" : q.id === 22 ? "options-frequency" : q.options.length >= 6 && q.options.every((option) => option.length < 70) ? "options-compact" : ""}`}
                    >
                      {q.options.map((option) => {
                        const selected =
                          q.kind === "multi"
                            ? value.includes(option)
                            : value === option;
                        return (
                          <button
                            key={option}
                            className={`option ${selected ? "selected" : ""}`}
                            aria-pressed={selected}
                            onClick={() => choose(option)}
                          >
                            <span>{option}</span>
                            <span
                              className={`selection ${q.kind === "multi" ? "square" : ""}`}
                            >
                              {selected ? "✓" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {(other || (q.id === 29 && value === "Oui")) && (
                    <label className="other-field">
                      {other
                        ? "Précise ta réponse"
                        : "Tu peux préciser, si tu le souhaites"}
                      <input
                        value={details[q.id] || ""}
                        onChange={(e) =>
                          setDetails({ ...details, [q.id]: e.target.value })
                        }
                        placeholder="Écris ici…"
                      />
                    </label>
                  )}
                </div>
                <div className="reassurance">
                  Réponds selon ton expérience. Il n’y a pas de bonne ou de
                  mauvaise réponse.
                </div>
              </div>
              {sendError && (
                <p className="send-error" role="alert">
                  {sendError}
                </p>
              )}
              <footer className="actions">
                <button
                  className="continue"
                  aria-busy={sending}
                  disabled={
                    sending ||
                    !valid ||
                    (q.kind === "number" &&
                      (Number(value) < 0 ||
                        Number(value) > (q.id === 1 ? 120 : 168)))
                  }
                  onClick={() => advance()}
                >
                  {sending
                    ? "Envoi en cours…"
                    : q.id === 32 || (q.id === 31 && value === "Non")
                      ? "Terminer"
                      : "Continuer"}
                  <span>→</span>
                </button>
              </footer>
              <div className="bottom-note">
                HABITUDES D’ÉTUDE ET BESOINS DES ÉLÈVES
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
