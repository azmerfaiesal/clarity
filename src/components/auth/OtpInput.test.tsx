import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OtpInput } from './OtpInput'

function ControlledOtpInput({
  autoFocus,
  disabled,
  invalid,
  initialValue = '',
  onChange = vi.fn(),
}: {
  autoFocus?: boolean
  disabled?: boolean
  invalid?: boolean
  initialValue?: string
  onChange?: (next: string) => void
}) {
  const [value, setValue] = useState(initialValue)

  return (
    <OtpInput
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
      autoFocus={autoFocus}
      disabled={disabled}
      invalid={invalid}
    />
  )
}

describe('OtpInput', () => {
  it('accepts typing only as six ASCII digits', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledOtpInput autoFocus onChange={onChange} />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    await user.type(input, '12a34 567٨')

    expect((input as HTMLInputElement).value).toBe('123456')
    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('filters and truncates a pasted code to six ASCII digits', async () => {
    const user = userEvent.setup()
    render(<ControlledOtpInput />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    await user.click(input)
    await user.paste('12x34 56789٠')

    expect((input as HTMLInputElement).value).toBe('123456')
  })

  it('removes the final digit when Backspace is pressed', async () => {
    const user = userEvent.setup()
    render(<ControlledOtpInput initialValue="123" />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    await user.click(input)
    await user.keyboard('[Backspace]')

    expect((input as HTMLInputElement).value).toBe('12')
  })

  it('keeps one real input focused over the visual slots', () => {
    render(<ControlledOtpInput autoFocus />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    expect(document.activeElement).toBe(input)
    expect(screen.getAllByTestId('otp-slot')).toHaveLength(6)
    expect(screen.getByTestId('otp-slots').getAttribute('aria-hidden')).toBe('true')
  })

  it('prevents interaction when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledOtpInput disabled onChange={onChange} />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    expect((input as HTMLInputElement).disabled).toBe(true)
    await user.type(input, '123456')

    expect((input as HTMLInputElement).value).toBe('')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('exposes invalid state without duplicating digits in the accessibility tree', () => {
    render(<ControlledOtpInput initialValue="123456" invalid />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByTestId('otp-slots').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByRole('textbox')).toHaveLength(1)
  })

  it('requests the mobile numeric keyboard and iOS one-time-code AutoFill', () => {
    render(<ControlledOtpInput />)

    const input = screen.getByRole('textbox', { name: /six-digit verification code/i })
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.getAttribute('autocomplete')).toBe('one-time-code')
  })
})
