import { Router, type RequestHandler } from 'express';
import {
  getScheduledEmails,
  getSearchEmails,
  getSentEmails,
  postCancelEmail,
  postScheduleCampaign,
} from '../controllers/scheduler';

export function createSchedulerRouter(authenticate: RequestHandler) {
  const router = Router();
  router.use(authenticate);
  router.post('/campaigns/schedule', postScheduleCampaign);
  router.get('/emails/scheduled', getScheduledEmails);
  router.get('/emails/sent', getSentEmails);
  router.get('/emails/search', getSearchEmails);
  router.post('/emails/:id/cancel', postCancelEmail);
  return router;
}
