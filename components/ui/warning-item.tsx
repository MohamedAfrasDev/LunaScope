/** One warning carried with a result: the machine code and its plain-language text. */
export function WarningItem({ code, text }: { code: string; text?: string }) {
  return (
    <li>
      <code className="break-all rounded bg-muted px-1 text-xs">{code}</code> <span className="text-muted-foreground">{text ?? ""}</span>
    </li>
  );
}
