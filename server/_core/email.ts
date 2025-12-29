import nodemailer from "nodemailer";
import { ENV } from "./env";

// Create reusable transporter object using the default SMTP transport
const createTransporter = () => {
    if (!ENV.smtpHost || !ENV.smtpUser) {
        return null;
    }

    return nodemailer.createTransport({
        host: ENV.smtpHost,
        port: ENV.smtpPort,
        secure: ENV.smtpPort === 465, // true for 465, false for other ports
        auth: {
            user: ENV.smtpUser,
            pass: ENV.smtpPass,
        },
    });
};

let transporter = createTransporter();

export type EmailPayload = {
    to: string;
    subject: string;
    text: string;
    html?: string;
};

/**
 * Sends an email using the configured SMTP server.
 * Returns true if sent successfully, false otherwise.
 */
export async function sendEmail({ to, subject, text, html }: EmailPayload): Promise<boolean> {
    // Re-check transporter in case env vars changed or it wasn't initialized
    if (!transporter) {
        transporter = createTransporter();
    }

    if (!transporter) {
        console.warn("[Email] SMTP not configured. Skipping email to:", to);
        return false;
    }

    try {
        const info = await transporter.sendMail({
            from: ENV.smtpFrom,
            to,
            subject,
            text,
            html: html || text,
        });
        console.log(`[Email] Sent to ${to}. MessageId: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("[Email] Error sending email:", error);
        return false;
    }
}
