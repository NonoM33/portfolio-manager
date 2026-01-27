import './globals.css'

export const metadata = {
  title: 'Trading Portfolio Manager',
  description: 'Gestion des investisseurs et commissions',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
