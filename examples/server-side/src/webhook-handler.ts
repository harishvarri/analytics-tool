/**
 * Webhook handler that emits analytics events for downstream signals
 * (e.g. payment provider notifications, ATS integrations).
 */
import type { Request, Response } from 'express';
import { analytics } from './analytics';

interface ATSWebhookBody {
  applicationId: string;
  candidateUserId: string;
  newStatus: 'submitted' | 'reviewing' | 'offered' | 'rejected';
}

export async function handleATSWebhook(req: Request, res: Response): Promise<void> {
  const body = req.body as ATSWebhookBody;

  analytics.track({
    category: 'feature',
    source: 'integration',
    name: `application.${body.newStatus}`,
    userId: body.candidateUserId,
    metadata: { applicationId: body.applicationId },
  });

  // Respond fast — the SDK queue handles delivery in the background.
  res.status(204).end();
}
