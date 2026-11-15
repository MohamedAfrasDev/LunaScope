/** A template remounts on every navigation, which restarts this short, tiny rise (see .page-in; none under reduced motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
