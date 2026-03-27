export function copyWithFeedback(
  text: string,
  setCopied: (v: boolean) => void,
): void {
  navigator.clipboard.writeText(text);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}
