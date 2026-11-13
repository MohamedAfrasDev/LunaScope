import type { Metadata } from "next";
import { AnalyzeForm } from "@/components/AnalyzeForm";

export const metadata: Metadata = { title: "New analysis" };

export default function AnalyzePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New analysis</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Configure the window, the requirements and the sites. A submitted analysis is an immutable snapshot:
        submitting the same inputs again returns the same run.
      </p>
      <div className="mt-6">
        <AnalyzeForm />
      </div>
    </div>
  );
}
