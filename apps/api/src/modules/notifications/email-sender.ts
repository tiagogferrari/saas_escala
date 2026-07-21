import nodemailer from "nodemailer";
import { z } from "zod";
import "../../config/load-env";

const mailEnvSchema = z.object({
  MAIL_FROM: z.string().trim().email().default("no-reply@escala.local"),
  MAIL_HOST: z.string().trim().min(1).default("localhost"),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().default(1025),
  MAIL_SECURE: z.enum(["true", "false"]).default("false"),
  MAIL_USER: z.string().trim().optional(),
});

const mailEnv = mailEnvSchema.parse(process.env);
const smtpHost =
  mailEnv.MAIL_HOST === "localhost" ? "127.0.0.1" : mailEnv.MAIL_HOST;

const transport = nodemailer.createTransport({
  host: smtpHost,
  port: mailEnv.MAIL_PORT,
  secure: mailEnv.MAIL_SECURE === "true",
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
  auth:
    mailEnv.MAIL_USER && mailEnv.MAIL_PASSWORD
      ? {
          user: mailEnv.MAIL_USER,
          pass: mailEnv.MAIL_PASSWORD,
        }
      : undefined,
});

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export async function sendEmail(message: EmailMessage) {
  await transport.sendMail({
    from: mailEnv.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

