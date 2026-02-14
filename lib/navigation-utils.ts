export function isLibraryPath(pathname: string): boolean {
  return pathname === '/members/library' || pathname.startsWith('/members/academy')
}
