import { Check, ChevronDown } from 'lucide-react'
import type { JSX, KeyboardEvent } from 'react'
import { useEffect, useId, useRef, useState } from 'react'

export type SelectMenuOption = {
  value: string
  label: string
  disabled?: boolean
}

type SelectMenuProps = {
  value: string
  options: SelectMenuOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  className?: string
  disabled?: boolean
  placement?: 'bottom' | 'top'
  title?: string
}

export function SelectMenu({
  value,
  options,
  onChange,
  ariaLabel,
  className,
  disabled = false,
  placement = 'bottom',
  title
}: SelectMenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) {
      return
    }

    const close = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const selectOption = (nextValue: string): void => {
    const option = options.find((item) => item.value === nextValue)
    if (!option || option.disabled) {
      return
    }

    onChange(nextValue)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const enabledOptions = options.filter((option) => !option.disabled)
      const currentIndex = Math.max(
        0,
        enabledOptions.findIndex((option) => option.value === value)
      )
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const nextIndex = (currentIndex + direction + enabledOptions.length) % enabledOptions.length
      selectOption(enabledOptions[nextIndex]?.value ?? value)
    }
  }

  return (
    <div className={className ? `select-menu-root ${className}` : 'select-menu-root'} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-controls={listId}
        className="select-menu-button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
        title={title}
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className={`select-menu-list select-menu-${placement}`} id={listId} role="listbox">
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className="select-menu-option"
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option.value)}
              role="option"
              type="button"
            >
              <span>{option.label}</span>
              {option.value === value ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
