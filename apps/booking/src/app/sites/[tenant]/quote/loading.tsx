import { PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <PageSkeleton blocks={["h-11", "h-11", "h-40", "h-12"]} />;
}
