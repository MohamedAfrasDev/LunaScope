import type { Metadata } from "next";
import { ExploreLoader } from "@/components/explore/ExploreLoader";

export const metadata: Metadata = { title: "Explore the Moon" };

export default function ExplorePage() {
  return (
    <div>
      <h1 className="type-title">Explore the Moon</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Turn the Moon, zoom toward the surface and look at the south pole. The picture is an illustration of the surface;
        analysis results come from the analysis pages.
      </p>
      <div className="mt-6">
        <ExploreLoader />
      </div>
    </div>
  );
}
