export const metadata = {
  title: "11+ Adventure",
  description: "Minecraft-styled 11+ practice (Kent/Bexley focus).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body style={{ margin: 0, minHeight: "100vh", background: "#c8e6c9" }}>
        {children}
      </body>
    </html>
  );
}
