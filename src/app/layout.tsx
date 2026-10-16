import type { Metadata } from "next";
import localFont from "next/font/local";
const headingFont = localFont({
  src: "../../node_modules/@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2",
  variable: "--font-heading",
  display: "swap",
  weight: "200 800",
});
import "./globals.css";
export const metadata: Metadata = {
  title: "GoFundMe · A little good goes a long way",
  description:
    "Discover the people making a difference. A fictional fundraising demo.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={headingFont.variable}>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
