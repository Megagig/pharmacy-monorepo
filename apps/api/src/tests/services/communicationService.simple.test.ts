import { CommunicationService } from '../../services/communicationService';

describe('CommunicationService - Simple Test', () => {
    it('should create service instance', () => {
        const service = new CommunicationService();
        expect(service).toBeDefined();
    });

    it('should have required methods', () => {
        const service = new CommunicationService();
        expect(typeof service.createConversation).toBe('function');
        expect(typeof service.addParticipant).toBe('function');
        expect(typeof service.removeParticipant).toBe('function');
        expect(typeof service.sendMessage).toBe('function');
        expect(typeof service.getConversations).toBe('function');
        expect(typeof service.getMessages).toBe('function');
        expect(typeof service.markMessageAsRead).toBe('function');
        expect(typeof service.searchMessages).toBe('function');
        expect(typeof service.updateConversationStatus).toBe('function');
        expect(typeof service.getConversationStats).toBe('function');
    });
});