import { PageSkeleton } from '@/components/shared/Skeletons';

export default function Loading() {
  return <PageSkeleton kpis={4} cards={2} />;
}
