/**
 * Cron job: send daily reminders for stale applications.
 * Emits one analytics event per reminder so the dashboard shows the volume.
 */
import { analytics } from './analytics';

interface Reminder {
  applicationId: string;
  candidateUserId: string;
  daysStale: number;
}

async function findStaleReminders(): Promise<Reminder[]> {
  // ...query your DB
  return [];
}

async function sendReminder(_r: Reminder): Promise<void> {
  // ...send the email / push
}

export async function runDailyReminderJob(): Promise<void> {
  const start = Date.now();
  const reminders = await findStaleReminders();
  for (const r of reminders) {
    try {
      await sendReminder(r);
      analytics.track({
        category: 'feature',
        source: 'server',
        name: 'reminder.sent',
        userId: r.candidateUserId,
        metadata: { applicationId: r.applicationId, daysStale: r.daysStale },
      });
    } catch (err) {
      analytics.trackError(err as Error, {
        job: 'daily-reminder',
        applicationId: r.applicationId,
      });
    }
  }
  analytics.trackCustomEvent('job.daily_reminder.completed', {
    sent: reminders.length,
    durationMs: Date.now() - start,
  });
  await analytics.flush();
}
