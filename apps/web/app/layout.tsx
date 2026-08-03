import type { ReactNode } from "react";
import "./globals.css";
import { SmsModeBadge } from "../components/SmsModeBadge";

export const metadata = {
  title: "an-telephony-tools",
  description: "Open-source call center / voice broadcast / P2P texting toolset",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SmsModeBadge />
        {children}
      </body>
    </html>
  );
}
