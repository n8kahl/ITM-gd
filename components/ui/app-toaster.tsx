'use client'

import { useEffect } from 'react'
import { Toaster } from 'sonner'

/**
 * Global toast container with explicit polite live-region semantics.
 */
export function AppToaster() {
  useEffect(() => {
    const applyA11yAttributes = () => {
      const nodes = document.querySelectorAll('[data-sonner-toaster]')
      nodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        node.setAttribute('aria-live', 'polite')
        node.setAttribute('role', 'status')
        if (!node.getAttribute('aria-label')) {
          node.setAttribute('aria-label', 'Notifications')
        }
      })
    }

    applyA11yAttributes()

    const observer = new MutationObserver(() => {
      applyA11yAttributes()
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => observer.disconnect()
  }, [])

  return <Toaster position="top-right" closeButton richColors />
}
