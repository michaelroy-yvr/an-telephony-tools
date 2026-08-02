export interface SendSmsParams {
  to: string;
  from: string;
  body: string;
  mediaUrls?: string[];
}

export interface SendSmsResult {
  providerMessageId: string;
  status: string;
}

export interface TelephonyProvider {
  sendSms(params: SendSmsParams): Promise<SendSmsResult>;
}
