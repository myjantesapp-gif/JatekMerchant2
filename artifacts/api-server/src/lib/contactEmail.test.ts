import assert from "node:assert/strict";
import test from "node:test";
import { parseContactForm } from "./contactEmail";

test("contact form parser trims and normalizes valid input", () => {
  assert.deepEqual(
    parseContactForm({
      name: "  Sara  ",
      email: " SARA@EXAMPLE.COM ",
      subject: " Besoin d’aide ",
      message: " Bonjour, je souhaite obtenir de l’aide. ",
    }),
    {
      name: "Sara",
      email: "sara@example.com",
      subject: "Besoin d’aide",
      message: "Bonjour, je souhaite obtenir de l’aide.",
    },
  );
});

test("contact form parser rejects malformed or oversized input", () => {
  assert.equal(parseContactForm({}), null);
  assert.equal(parseContactForm({
    name: "S",
    email: "incorrect",
    subject: "Ok",
    message: "Trop court",
  }), null);
  assert.equal(parseContactForm({
    name: "Sara",
    email: "sara@example.com",
    subject: "Question",
    message: "x".repeat(5_001),
  }), null);
});