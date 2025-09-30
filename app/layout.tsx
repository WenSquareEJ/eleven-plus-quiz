export const metadata = {
  title: "11+ Adventure",
  description: "Minecraft-styled 11+ practice (Kent/Bexley).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>{children}</body>
    </html>
  );
}
