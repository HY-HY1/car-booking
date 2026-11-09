import { PageSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <PageSkeleton blocks={["h-56", "h-32", "h-32"]} />;
}
