export const metadata = {
  title: "11+ Adventure",
  description: "Minecraft-styled 11+ practice site (Kent/Bexley focus).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body className="min-h-screen bg-[#c8e6c9]">{children}</body>
    </html>
  );
}
