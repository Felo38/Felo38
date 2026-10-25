// Pass-through root. The <html> and <body> tags live in app/[locale]/layout.tsx, where the lang and dir are set.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children
}
