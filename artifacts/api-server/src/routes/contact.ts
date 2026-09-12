import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";
import { parseContactForm, sendContactEmail } from "../lib/contactEmail";

const router: IRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/contact", contactLimiter, async (req, res): Promise<void> => {
  // Honeypot field: real visitors never fill it.
  if (typeof req.body?.website === "string" && req.body.website.trim()) {
    res.status(202).json({ sent: true });
    return;
  }

  const input = parseContactForm(req.body);
  if (!input) {
    res.status(400).json({ error: "Veuillez vérifier les informations du formulaire." });
    return;
  }

  try {
    await sendContactEmail(input);
    res.status(201).json({ sent: true });
  } catch (error) {
    logger.error({ err: error }, "Public contact email failed");
    res.status(503).json({ error: "Le message n’a pas pu être envoyé. Veuillez réessayer plus tard." });
  }
});

export default router;