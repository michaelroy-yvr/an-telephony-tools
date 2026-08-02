import type { TelephonyProvider, SendSmsParams, SendSmsResult } from "./provider";

export class MockProvider implements TelephonyProvider {
  async sendSms({ to, body }: SendSmsParams): Promise<SendSmsResult> {
    console.log(`[mock-sms] to=${to} body=${JSON.stringify(body)}`);
    return { providerMessageId: `mock_${Date.now()}`, status: "sent" };
  }
}
