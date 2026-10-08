import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

export type OutboundMail = { to: string; subject: string; text: string };

export type Mailer = {
  send(mail: OutboundMail): Promise<void>;
};

const silentMailer: Mailer = {
  async send() {
    return undefined;
  },
};

let override: Mailer | null = null;

/** Tests replace the sender. Production uses SMTP; test runs stay silent unless a test sets a mailer. */
export function useMailer(mailer: Mailer | null): void {
  override = mailer;
}

export function resolveMailer(explicit?: Mailer): Mailer {
  if (explicit) return explicit;
  if (override) return override;
  if (process.env.NODE_ENV === "test") return silentMailer;
  return smtpMailer();
}

function smtpMailer(): Mailer {
  const env = getEnv();
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    connectionTimeout: 2000,
    greetingTimeout: 2000,
    socketTimeout: 3000,
  });
  return {
    async send(mail) {
      await transport.sendMail({ from: env.SMTP_FROM, to: mail.to, subject: mail.subject, text: mail.text });
    },
  };
}
