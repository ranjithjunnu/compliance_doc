// A modal dialog. Radix handles focus trapping, Escape to close and screen-reader labels.
import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-overlay" />
        <RadixDialog.Content className="dialog" {...(description ? {} : { 'aria-describedby': undefined })}>
          <header className="dialog-header">
            <RadixDialog.Title className="dialog-title">{title}</RadixDialog.Title>
            {description ? (
              <RadixDialog.Description className="dialog-description">{description}</RadixDialog.Description>
            ) : null}
          </header>
          <div className="dialog-body">{children}</div>
          {footer ? <footer className="dialog-footer">{footer}</footer> : null}
          <RadixDialog.Close className="dialog-close" aria-label="Close">
            <span aria-hidden="true">×</span>
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}
