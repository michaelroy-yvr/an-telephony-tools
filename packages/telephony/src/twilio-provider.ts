import twilio from "twilio";
import type { TelephonyProvider, SendSmsParams, SendSmsResult } from "./provider";

export class TwilioProvider implements TelephonyProvider {
  private client: ReturnType<typeof twilio>;

  constructor(accountSid: string, authToken: string) {
    this.client = twilio(accountSid, authToken);
  }

  async sendSms({ to, from, body, mediaUrls }: SendSmsParams): Promise<SendSmsResult> {
    const message = await this.client.messages.create({ to, from, body, mediaUrl: mediaUrls });
    return { providerMessageId: message.sid, status: message.status };
  }
}
