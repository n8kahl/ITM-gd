export default function AdminLoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Render login page without the admin shell
  return <>{children}</>
}
