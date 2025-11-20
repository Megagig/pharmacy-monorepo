import express from 'express';
import { supportController } from '../controllers/supportController';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Apply authentication to all routes (but no role restrictions)
router.use(auth);

/**
 * Public Help Routes
 * These routes are accessible to ALL authenticated users regardless of role
 * No super admin or role restrictions applied
 */

// Get help content (FAQs, Articles, Videos) with search and filtering
router.get('/content', 
  supportController.getHelpContent.bind(supportController)
);

// Get help categories
router.get('/categories', 
  supportController.getHelpCategories.bind(supportController)
);

// Submit help feedback
router.post('/feedback', 
  supportController.submitHelpFeedback.bind(supportController)
);

// Get help contact information
router.get('/contact-info', 
  supportController.getHelpContactInfo.bind(supportController)
);

// Generate PDF manual
router.get('/manual/pdf', 
  supportController.generatePDFManual.bind(supportController)
);

// Get knowledge base articles
router.get('/knowledge-base/articles', 
  supportController.getArticles.bind(supportController)
);

// Search knowledge base
router.get('/knowledge-base/search', 
  supportController.searchArticles.bind(supportController)
);

// Get specific knowledge base article
router.get('/knowledge-base/articles/:id', 
  supportController.getKnowledgeBaseArticleById.bind(supportController)
);

// FAQ voting route
router.post('/faqs/:id/vote', 
  supportController.voteFAQ.bind(supportController)
);

// Support ticket routes for all users
router.post('/tickets', 
  supportController.createTicket.bind(supportController)
);

router.get('/tickets/:ticketId', 
  supportController.getTicketById.bind(supportController)
);

router.post('/tickets/:ticketId/comments', 
  supportController.addComment.bind(supportController)
);

router.get('/tickets/:ticketId/comments', 
  supportController.getTicketComments.bind(supportController)
);

export default router;