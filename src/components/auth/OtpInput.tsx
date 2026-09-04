type OtpInputProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  invalid?: boolean
  autoFocus?: boolean
}

const normalize = (raw: string) => raw.replace(/[^0-9]/g, '').slice(0, 6)

export function OtpInput({ value, onChange, disabled, invalid, autoFocus }: OtpInputProps) {
  return (
    <div className="relative" data-invalid={invalid || undefined}>
      <input
        aria-label="Six-digit verification code"
        aria-invalid={invalid || undefined}
        autoComplete="one-time-code"
        autoFocus={autoFocus}
        disabled={disabled}
        inputMode="numeric"
        maxLength={6}
        onChange={(event) => onChange(normalize(event.currentTarget.value))}
        onPaste={(event) => {
          event.preventDefault()
          onChange(normalize(event.clipboardData.getData('text')))
        }}
        pattern="[0-9]*"
        value={value}
        className="absolute inset-0 z-10 h-full w-full cursor-text appearance-none bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
      />
      <div aria-hidden="true" className="pointer-events-none grid grid-cols-6 gap-2" data-testid="otp-slots">
        {Array.from({ length: 6 }, (_, index) => (
          <span
            className="flex aspect-square items-center justify-center rounded-lg border border-line bg-raised text-lg font-semibold text-ink shadow-sm shadow-black/5 dark:shadow-black/40"
            data-filled={value[index] ? true : undefined}
            data-testid="otp-slot"
            key={index}
          >
            {value[index] ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
