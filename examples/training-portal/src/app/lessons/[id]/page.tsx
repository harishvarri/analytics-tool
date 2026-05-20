'use client';

/**
 * Example feature component — tracks a feature.used event on mount and a
 * custom 'lesson.completed' event from a callback. Notice that the component
 * imports domain-specific helpers, not the raw SDK.
 */
import { useEffect } from 'react';
import { trackLessonCompleted, trackLessonViewed } from '@/lib/analytics';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LessonPage({ params }: PageProps) {
  // In a real app you'd unwrap params via React.use() — abbreviated here.
  useEffect(() => {
    void params.then((p) => trackLessonViewed(Number(p.id)));
  }, [params]);

  return (
    <div className="prose">
      <h1>Lesson</h1>
      <button
        onClick={async () => {
          const { id } = await params;
          trackLessonCompleted(Number(id), 0.92);
        }}
      >
        Mark complete
      </button>
    </div>
  );
}
