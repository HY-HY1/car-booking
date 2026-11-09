import { PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <PageSkeleton blocks={["h-48", "h-12"]} />;
}
