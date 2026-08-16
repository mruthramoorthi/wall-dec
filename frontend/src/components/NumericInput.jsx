// Enforces "number with or without decimal" at the keystroke level, not just
// on submit (per SRS section 7).
export default function NumericInput({ value, onChange, placeholder, style, ...rest }) {
  const handleChange = (e) => {
    const v = e.target.value;
    if (v === '' || /^\d*\.?\d*$/.test(v)) {
      onChange(v);
    }
  };
  return (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      style={{ textAlign: 'right', ...style }}
      {...rest}
    />
  );
}
