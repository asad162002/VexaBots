import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/layout/Nav";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Asad Land Holdings — CRM",
  description: "Internal CRM for Asad Land Holdings",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = "";
  if (user) {
    const { data: employee } = await supabase
      .from("employees")
      .select("role")
      .eq("id", user.id)
      .single();
    role = employee?.role ?? "employee";
  }

  return (
    <html lang="en">
      <body className={`${manrope.variable} font-sans antialiased`}>
        {user && <Nav role={role} />}
        {children}
      </body>
    </html>
  );
}