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
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listId = useId()
  const selected = options.find((option) => option.value === value)
  const enabledIndexes = options.reduce<number[]>((indexes, option, index) => {
    if (!option.disabled) {
      indexes.push(index)
    }
    return indexes
  }, [])

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

  useEffect(() => {
    if (!open) {
      return
    }

    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
    const nextIndex = selectedIndex >= 0 ? selectedIndex : (enabledIndexes[0] ?? -1)
    setActiveIndex(nextIndex)
    window.requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus())
  }, [open])

  const selectOption = (nextValue: string): void => {
    const option = options.find((item) => item.value === nextValue)
    if (!option || option.disabled) {
      return
    }

    onChange(nextValue)
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const openFromKeyboard = (direction: 1 | -1): void => {
    if (enabledIndexes.length === 0) {
      return
    }

    const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)
    const selectedPosition = enabledIndexes.indexOf(selectedIndex)
    const nextPosition = selectedPosition >= 0 ? selectedPosition : direction === 1 ? -1 : 0
    setActiveIndex(enabledIndexes[(nextPosition + direction + enabledIndexes.length) % enabledIndexes.length] ?? -1)
    setOpen(true)
  }

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      if (event.key === 'Home') {
        setActiveIndex(enabledIndexes[0] ?? -1)
        setOpen(true)
      } else if (event.key === 'End') {
        setActiveIndex(enabledIndexes.at(-1) ?? -1)
        setOpen(true)
      } else {
        openFromKeyboard(event.key === 'ArrowDown' ? 1 : -1)
      }
    }
  }

  const handleOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, optionIndex: number): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
      return
    }

    if (event.key === 'Tab') {
      setOpen(false)
      return
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const currentPosition = enabledIndexes.indexOf(optionIndex)
    let nextIndex = optionIndex
    if (event.key === 'Home') {
      nextIndex = enabledIndexes[0] ?? optionIndex
    } else if (event.key === 'End') {
      nextIndex = enabledIndexes.at(-1) ?? optionIndex
    } else {
      const direction = event.key === 'ArrowDown' ? 1 : -1
      nextIndex = enabledIndexes[(currentPosition + direction + enabledIndexes.length) % enabledIndexes.length] ?? optionIndex
    }
    setActiveIndex(nextIndex)
    optionRefs.current[nextIndex]?.focus()
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
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        title={title}
        type="button"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className={`select-menu-list select-menu-${placement}`} id={listId} role="listbox">
          {options.map((option, optionIndex) => (
            <button
              aria-current={optionIndex === activeIndex ? 'true' : undefined}
              aria-selected={option.value === value}
              className="select-menu-option"
              disabled={option.disabled}
              key={option.value}
              onClick={() => selectOption(option.value)}
              onKeyDown={(event) => handleOptionKeyDown(event, optionIndex)}
              ref={(node) => {
                optionRefs.current[optionIndex] = node
              }}
              role="option"
              tabIndex={optionIndex === activeIndex ? 0 : -1}
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
