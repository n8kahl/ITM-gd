import { permanentRedirect } from 'next/navigation'

export default function LibraryPage() {
  // Canonical training library route now lives under academy v3.
  permanentRedirect('/members/academy-v3/modules')
}
