import { permanentRedirect } from 'next/navigation'

export default function LibraryPage() {
  // Canonical training library route now lives under the academy namespace.
  permanentRedirect('/members/academy/courses')
}
