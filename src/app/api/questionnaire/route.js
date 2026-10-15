import { google } from "googleapis";
import { createPostHandler } from "../../../lib/questionnaire-handler.mjs";
import questions from "../../questions.json";

export const POST = createPostHandler({ google, questions });
