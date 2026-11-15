// Preview validation only; future product writes must validate again in NestJS.
// Fixed-scale BigInt avoids rounding NUMBER rules through JavaScript floats.
function number(value) {
  if (!/^-?\d{1,18}(?:\.\d{1,6})?$/.test(value)) return null;
  const negative = value.startsWith("-"),
    [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  const n = BigInt(whole) * 1000000n + BigInt(fraction.padEnd(6, "0"));
  return negative ? -n : n;
}
export function previewErrors(version, values) {
  const errors = [];
  for (const field of version.attributes) {
    const s = field.snapshot;
    if (!s.visibility.admin) continue;
    const selected = values.getAll(field.id).map(String),
      value = selected[0] ?? "",
      r = s.rules;
    if (s.dataType === "BOOLEAN") continue; // false is a valid present Boolean value.
    if (field.required && !value) {
      errors.push(`${s.label}: a value is required.`);
      continue;
    }
    if (!value && s.dataType !== "MULTI_SELECT") continue;
    if (s.dataType === "TEXT") {
      if (
        value.length < (r.minLength ?? 0) ||
        value.length > (r.maxLength ?? 10000)
      )
        errors.push(`${s.label}: check the text length.`);
      if (r.allowedValues && !r.allowedValues.includes(value))
        errors.push(`${s.label}: choose an allowed value.`);
    } else if (s.dataType === "NUMBER") {
      const n = number(value);
      if (n === null) {
        errors.push(
          `${s.label}: use an exact decimal with at most six fractional digits.`,
        );
        continue;
      }
      if (
        (r.min !== undefined && n < number(r.min)) ||
        (r.max !== undefined && n > number(r.max))
      )
        errors.push(`${s.label}: check the numeric range.`);
      if (
        r.step !== undefined &&
        (n - number(r.min ?? "0")) % number(r.step) !== 0n
      )
        errors.push(`${s.label}: check the increment.`);
      if (r.allowedValues && !r.allowedValues.some((v) => number(v) === n))
        errors.push(`${s.label}: choose an allowed number.`);
    } else {
      if (selected.some((id) => !s.options.some((o) => o.id === id)))
        errors.push(`${s.label}: choose a configured option.`);
      if (
        s.dataType === "MULTI_SELECT" &&
        (selected.length < Math.max(r.minItems ?? 0, field.required ? 1 : 0) ||
          selected.length > (r.maxItems ?? s.options.length))
      )
        errors.push(`${s.label}: check the number of selections.`);
    }
  }
  return errors;
}
