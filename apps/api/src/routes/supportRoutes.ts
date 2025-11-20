import express from 'express';
import { supportController } from '../controllers/supportController';
import { auth } from '../middlewares/auth';
import { requireRole } from '../middlewares/rbac';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Ticket Management Routes
router.post('/tickets', 
  supportController.createTicket.bind(supportController)
);

router.get('/tickets', 
  requireRole('super_admin', 'admin', 'support_agent'), 
  supportController.getTickets.bind(supportController)
);

router.get('/tickets/:ticketId', 
  supportController.getTicketById.bind(supportController)
);

router.put('/tickets/:ticketId/assign', 
  requireRole('super_admin'), 
  supportController.assignTicket.bind(supportController)
);

router.put('/tickets/:ticketId/status', 
  requireRole('super_admin', 'admin', 'support_agent'), 
  supportController.updateTicketStatus.bind(supportController)
);

router.put('/tickets/:ticketId/escalate', 
  requireRole('super_admin', 'admin', 'support_agent'), 
  supportController.escalateTicket.bind(supportController)
);

router.post('/tickets/:ticketId/comments', 
  supportController.addComment.bind(supportController)
);

router.get('/tickets/:ticketId/comments', 
  supportController.getTicketComments.bind(supportController)
);

// These routes are moved to the Knowledge Base Article Management section below

router.get('/metrics', 
  requireRole('super_admin', 'admin'), 
  supportController.getSupportMetrics.bind(supportController)
);

router.get('/analytics', 
  requireRole('super_admin', 'admin'), 
  supportController.getSupportAnalytics.bind(supportController)
);

// Help System Routes

// Public help content routes (accessible to ALL authenticated users)
router.get('/help/content', 
  supportController.getHelpContent.bind(supportController)
);

router.get('/help/categories', 
  supportController.getHelpCategories.bind(supportController)
);

router.post('/help/feedback', 
  supportController.submitHelpFeedback.bind(supportController)
);

router.get('/help/manual/pdf', 
  supportController.generatePDFManual.bind(supportController)
);

router.get('/help/contact-info', 
  supportController.getHelpContactInfo.bind(supportController)
);

// Super Admin only routes
router.get('/help/settings', 
  requireRole('super_admin'), 
  supportController.getHelpSettings.bind(supportController)
);

router.put('/help/settings', 
  requireRole('super_admin'), 
  supportController.updateHelpSettings.bind(supportController)
);

router.get('/help/analytics', 
  requireRole('super_admin'), 
  supportController.getHelpAnalytics.bind(supportController)
);

// FAQ Management (Super Admin only)
router.post('/help/faqs', 
  requireRole('super_admin'), 
  supportController.createFAQ.bind(supportController)
);

router.put('/help/faqs/:id', 
  requireRole('super_admin'), 
  supportController.updateFAQ.bind(supportController)
);

router.delete('/help/faqs/:id', 
  requireRole('super_admin'), 
  supportController.deleteFAQ.bind(supportController)
);

// Video Management (Super Admin only)
router.post('/help/videos', 
  requireRole('super_admin'), 
  supportController.createVideo.bind(supportController)
);

router.put('/help/videos/:id', 
  requireRole('super_admin'), 
  supportController.updateVideo.bind(supportController)
);

router.delete('/help/videos/:id', 
  requireRole('super_admin'), 
  supportController.deleteVideo.bind(supportController)
);

// Feedback Management (Super Admin only)
router.get('/help/feedback', 
  requireRole('super_admin'), 
  supportController.getAllFeedback.bind(supportController)
);

router.put('/help/feedback/:id/respond', 
  requireRole('super_admin'), 
  supportController.respondToFeedback.bind(supportController)
);

// Knowledge Base Article Management (Super Admin only for CRUD, public for reading)
router.post('/knowledge-base/articles', 
  requireRole('super_admin'), 
  supportController.createKnowledgeBaseArticle.bind(supportController)
);

router.get('/knowledge-base/articles', 
  supportController.getArticles.bind(supportController)
);

router.get('/knowledge-base/search', 
  supportController.searchArticles.bind(supportController)
);

router.get('/knowledge-base/articles/:id', 
  supportController.getKnowledgeBaseArticleById.bind(supportController)
);

router.put('/knowledge-base/articles/:id', 
  requireRole('super_admin'), 
  supportController.updateKnowledgeBaseArticle.bind(supportController)
);

router.delete('/knowledge-base/articles/:id', 
  requireRole('super_admin'), 
  supportController.deleteKnowledgeBaseArticle.bind(supportController)
);

export default router;
