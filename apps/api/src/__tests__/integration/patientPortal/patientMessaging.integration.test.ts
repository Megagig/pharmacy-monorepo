import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import PatientUser from '../../../models/PatientUser';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import Message from '../../../models/Message';
import MessageThread from '../../../models/MessageThread';
import { generateToken } from '../../../utils/token';

describe('Patient Messaging Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let testPharmacist: any;
  let testThread: any;
  let testMessage: any;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'admin@testpharmacy.com',
      phone: '+2348012345678',
      address: '123 Test Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Lagos Island',
      licenseNumber: 'PCN-TEST-001',
      isActive: true,
      subscriptionStatus: 'active'
    });

    // Create test pharmacist
    testPharmacist = await User.create({
      firstName: 'Dr. Jane',
      lastName: 'Pharmacist',
      email: 'pharmacist@testpharmacy.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isEmailVerified: true,
      status: 'active'
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348087654321',
      email: 'john.doe@example.com',
      address: '456 Patient Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Ikeja',
      workplaceId: testWorkplace._id
    });

    // Create test patient user
    testPatientUser = await PatientUser.create({
      email: 'john.doe@example.com',
      password: 'password123',
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      status: 'active',
      isEmailVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        appointmentReminders: true,
        medicationReminders: true,
        refillReminders: true
      }
    });

    // Create message thread
    testThread = await MessageThread.create({
      participants: [
        {
          userId: testPatientUser._id,
          userType: 'patient',
          name: `${testPatient.firstName} ${testPatient.lastName}`,
          avatar: null
        },
        {
          userId: testPharmacist._id,
          userType: 'pharmacist',
          name: `${testPharmacist.firstName} ${testPharmacist.lastName}`,
          avatar: null
        }
      ],
      workplaceId: testWorkplace._id,
      subject: 'Medication Question',
      status: 'active',
      priority: 'normal',
      tags: ['medication', 'consultation'],
      lastActivity: new Date(),
      createdBy: testPatientUser._id
    });

    // Create test message
    testMessage = await Message.create({
      threadId: testThread._id,
      senderId: testPatientUser._id,
      senderType: 'patient',
      content: 'Hello, I have a question about my medication.',
      messageType: 'text',
      workplaceId: testWorkplace._id,
      isRead: false,
      readBy: [],
      createdAt: new Date()
    });

    // Generate patient token
    patientToken = generateToken(testPatientUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
    await Message.deleteMany({});
    await MessageThread.deleteMany({});
  });

  describe('Message Threads', () => {
    describe('GET /api/patient-portal/messages/threads', () => {
      it('should return patient message threads', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].subject).toBe('Medication Question');
        expect(response.body.data[0].participants).toHaveLength(2);
      });

      it('should filter threads by status', async () => {
        // Create closed thread
        await MessageThread.create({
          participants: [
            {
              userId: testPatientUser._id,
              userType: 'patient',
              name: `${testPatient.firstName} ${testPatient.lastName}`
            },
            {
              userId: testPharmacist._id,
              userType: 'pharmacist',
              name: `${testPharmacist.firstName} ${testPharmacist.lastName}`
            }
          ],
          workplaceId: testWorkplace._id,
          subject: 'Closed Thread',
          status: 'closed',
          priority: 'low',
          lastActivity: new Date(),
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/messages/threads?status=active')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('active');
      });

      it('should sort threads by last activity', async () => {
        // Create older thread
        const olderDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
        await MessageThread.create({
          participants: [
            {
              userId: testPatientUser._id,
              userType: 'patient',
              name: `${testPatient.firstName} ${testPatient.lastName}`
            },
            {
              userId: testPharmacist._id,
              userType: 'pharmacist',
              name: `${testPharmacist.firstName} ${testPharmacist.lastName}`
            }
          ],
          workplaceId: testWorkplace._id,
          subject: 'Older Thread',
          status: 'active',
          priority: 'normal',
          lastActivity: olderDate,
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        // Most recent should come first
        expect(response.body.data[0].subject).toBe('Medication Question');
        expect(response.body.data[1].subject).toBe('Older Thread');
      });

      it('should include unread message count', async () => {
        // Add another unread message
        await Message.create({
          threadId: testThread._id,
          senderId: testPharmacist._id,
          senderType: 'pharmacist',
          content: 'I can help you with that.',
          messageType: 'text',
          workplaceId: testWorkplace._id,
          isRead: false,
          readBy: []
        });

        const response = await request(testApp)
          .get('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data[0].unreadCount).toBeGreaterThan(0);
      });

      it('should paginate results', async () => {
        // Create additional threads
        for (let i = 1; i <= 5; i++) {
          await MessageThread.create({
            participants: [
              {
                userId: testPatientUser._id,
                userType: 'patient',
                name: `${testPatient.firstName} ${testPatient.lastName}`
              },
              {
                userId: testPharmacist._id,
                userType: 'pharmacist',
                name: `${testPharmacist.firstName} ${testPharmacist.lastName}`
              }
            ],
            workplaceId: testWorkplace._id,
            subject: `Thread ${i}`,
            status: 'active',
            priority: 'normal',
            lastActivity: new Date(Date.now() - i * 60 * 60 * 1000),
            createdBy: testPatientUser._id
          });
        }

        const response = await request(testApp)
          .get('/api/patient-portal/messages/threads?limit=3&page=1')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination.totalPages).toBeGreaterThan(1);
      });

      it('should require authentication', async () => {
        await request(testApp)
          .get('/api/patient-portal/messages/threads')
          .expect(401);
      });
    });

    describe('POST /api/patient-portal/messages/threads', () => {
      it('should create new message thread', async () => {
        const threadData = {
          recipientId: testPharmacist._id,
          recipientType: 'pharmacist',
          subject: 'New Question',
          initialMessage: 'I need help with my prescription.',
          priority: 'normal',
          tags: ['prescription', 'help']
        };

        const response = await request(testApp)
          .post('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(threadData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.subject).toBe('New Question');
        expect(response.body.data.participants).toHaveLength(2);
        expect(response.body.data.status).toBe('active');
      });

      it('should validate thread data', async () => {
        const invalidData = {
          recipientId: 'invalid-id',
          subject: '', // Required field empty
          initialMessage: 'Message'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should validate recipient exists in same workplace', async () => {
        // Create pharmacist in different workplace
        const differentWorkplace = await Workplace.create({
          name: 'Different Pharmacy',
          email: 'admin@different.com',
          phone: '+2348012345679',
          address: '789 Different Street, Lagos, Nigeria',
          state: 'Lagos',
          lga: 'Ikeja',
          licenseNumber: 'PCN-DIFF-001',
          isActive: true,
          subscriptionStatus: 'active'
        });

        const differentPharmacist = await User.create({
          firstName: 'Different',
          lastName: 'Pharmacist',
          email: 'different@pharmacy.com',
          password: 'password123',
          role: 'pharmacist',
          workplaceId: differentWorkplace._id,
          isEmailVerified: true,
          status: 'active'
        });

        const threadData = {
          recipientId: differentPharmacist._id,
          recipientType: 'pharmacist',
          subject: 'Cross-workplace message',
          initialMessage: 'This should not work.'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(threadData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('workplace');
      });

      it('should create initial message in thread', async () => {
        const threadData = {
          recipientId: testPharmacist._id,
          recipientType: 'pharmacist',
          subject: 'Thread with Message',
          initialMessage: 'This is the first message.',
          priority: 'high'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/messages/threads')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(threadData)
          .expect(201);

        expect(response.body.success).toBe(true);
        
        // Verify initial message was created
        const messages = await Message.find({ threadId: response.body.data._id });
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe('This is the first message.');
        expect(messages[0].senderId.toString()).toBe(testPatientUser._id.toString());
      });
    });

    describe('GET /api/patient-portal/messages/threads/:threadId', () => {
      it('should return thread details with messages', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/messages/threads/${testThread._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.subject).toBe('Medication Question');
        expect(response.body.data.messages).toHaveLength(1);
        expect(response.body.data.messages[0].content).toBe('Hello, I have a question about my medication.');
      });

      it('should mark messages as read when viewing thread', async () => {
        // Add unread message from pharmacist
        await Message.create({
          threadId: testThread._id,
          senderId: testPharmacist._id,
          senderType: 'pharmacist',
          content: 'I can help you with that.',
          messageType: 'text',
          workplaceId: testWorkplace._id,
          isRead: false,
          readBy: []
        });

        const response = await request(testApp)
          .get(`/api/patient-portal/messages/threads/${testThread._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        // Verify messages are marked as read
        const messages = await Message.find({ threadId: testThread._id });
        const unreadMessages = messages.filter(msg => 
          msg.senderId.toString() !== testPatientUser._id.toString() && !msg.isRead
        );
        expect(unreadMessages).toHaveLength(0);
      });

      it('should return 404 for non-existent thread', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/messages/threads/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });

      it('should not allow access to other patients threads', async () => {
        // Create another patient and thread
        const otherPatient = await Patient.create({
          firstName: 'Other',
          lastName: 'Patient',
          dateOfBirth: new Date('1985-01-01'),
          gender: 'female',
          phone: '+2348087654999',
          email: 'other@example.com',
          workplaceId: testWorkplace._id
        });

        const otherPatientUser = await PatientUser.create({
          email: 'other@example.com',
          password: 'password123',
          patientId: otherPatient._id,
          workplaceId: testWorkplace._id,
          status: 'active',
          isEmailVerified: true
        });

        const otherThread = await MessageThread.create({
          participants: [
            {
              userId: otherPatientUser._id,
              userType: 'patient',
              name: `${otherPatient.firstName} ${otherPatient.lastName}`
            },
            {
              userId: testPharmacist._id,
              userType: 'pharmacist',
              name: `${testPharmacist.firstName} ${testPharmacist.lastName}`
            }
          ],
          workplaceId: testWorkplace._id,
          subject: 'Other Patient Thread',
          status: 'active',
          priority: 'normal',
          lastActivity: new Date(),
          createdBy: otherPatientUser._id
        });

        // Try to access other patient's thread
        await request(testApp)
          .get(`/api/patient-portal/messages/threads/${otherThread._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });

      it('should paginate messages within thread', async () => {
        // Create multiple messages
        for (let i = 1; i <= 10; i++) {
          await Message.create({
            threadId: testThread._id,
            senderId: i % 2 === 0 ? testPharmacist._id : testPatientUser._id,
            senderType: i % 2 === 0 ? 'pharmacist' : 'patient',
            content: `Message ${i}`,
            messageType: 'text',
            workplaceId: testWorkplace._id,
            isRead: false,
            readBy: [],
            createdAt: new Date(Date.now() + i * 1000)
          });
        }

        const response = await request(testApp)
          .get(`/api/patient-portal/messages/threads/${testThread._id}?messageLimit=5&messagePage=1`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(5);
        expect(response.body.data.messagePagination.totalPages).toBeGreaterThan(1);
      });
    });
  });

  describe('Sending Messages', () => {
    describe('POST /api/patient-portal/messages/threads/:threadId/messages', () => {
      it('should send text message in thread', async () => {
        const messageData = {
          content: 'Thank you for your help!',
          messageType: 'text'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.content).toBe('Thank you for your help!');
        expect(response.body.data.senderId).toBe(testPatientUser._id.toString());
        expect(response.body.data.senderType).toBe('patient');
      });

      it('should validate message data', async () => {
        const invalidData = {
          content: '', // Required field empty
          messageType: 'invalid-type'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should update thread last activity when sending message', async () => {
        const originalLastActivity = testThread.lastActivity;
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        const messageData = {
          content: 'New message to update activity',
          messageType: 'text'
        };

        await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(201);

        // Verify thread last activity was updated
        const updatedThread = await MessageThread.findById(testThread._id);
        expect(updatedThread?.lastActivity.getTime()).toBeGreaterThan(originalLastActivity.getTime());
      });

      it('should not allow sending to closed threads', async () => {
        // Close the thread
        await MessageThread.findByIdAndUpdate(testThread._id, { status: 'closed' });

        const messageData = {
          content: 'Message to closed thread',
          messageType: 'text'
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('closed');
      });

      it('should handle message with attachments', async () => {
        const messageData = {
          content: 'Please see attached image',
          messageType: 'text',
          attachments: [
            {
              fileName: 'prescription.jpg',
              fileUrl: 'https://example.com/files/prescription.jpg',
              fileType: 'image/jpeg',
              fileSize: 1024000
            }
          ]
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.attachments).toHaveLength(1);
        expect(response.body.data.attachments[0].fileName).toBe('prescription.jpg');
      });

      it('should validate attachment file types', async () => {
        const messageData = {
          content: 'Invalid attachment',
          messageType: 'text',
          attachments: [
            {
              fileName: 'malicious.exe',
              fileUrl: 'https://example.com/files/malicious.exe',
              fileType: 'application/x-executable',
              fileSize: 1024000
            }
          ]
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('file type');
      });

      it('should validate attachment file size', async () => {
        const messageData = {
          content: 'Large attachment',
          messageType: 'text',
          attachments: [
            {
              fileName: 'large-file.pdf',
              fileUrl: 'https://example.com/files/large-file.pdf',
              fileType: 'application/pdf',
              fileSize: 50 * 1024 * 1024 // 50MB - exceeds limit
            }
          ]
        };

        const response = await request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('file size');
      });
    });
  });

  describe('File Upload', () => {
    describe('POST /api/patient-portal/messages/upload', () => {
      it('should upload file for messaging', async () => {
        // Mock file upload - in real tests, you'd use actual file buffer
        const mockFileBuffer = Buffer.from('fake-file-data');
        
        const response = await request(testApp)
          .post('/api/patient-portal/messages/upload')
          .set('Cookie', `patientToken=${patientToken}`)
          .attach('file', mockFileBuffer, 'test-document.pdf')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('fileUrl');
        expect(response.body.data).toHaveProperty('fileName');
        expect(response.body.data.fileName).toBe('test-document.pdf');
      });

      it('should reject unauthorized file types', async () => {
        const mockFileBuffer = Buffer.from('fake-executable-data');
        
        await request(testApp)
          .post('/api/patient-portal/messages/upload')
          .set('Cookie', `patientToken=${patientToken}`)
          .attach('file', mockFileBuffer, 'malicious.exe')
          .expect(400);
      });

      it('should reject files exceeding size limit', async () => {
        // Create buffer larger than allowed limit
        const largeMockBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB
        
        await request(testApp)
          .post('/api/patient-portal/messages/upload')
          .set('Cookie', `patientToken=${patientToken}`)
          .attach('file', largeMockBuffer, 'large-file.pdf')
          .expect(400);
      });

      it('should require authentication', async () => {
        const mockFileBuffer = Buffer.from('fake-file-data');
        
        await request(testApp)
          .post('/api/patient-portal/messages/upload')
          .attach('file', mockFileBuffer, 'test.pdf')
          .expect(401);
      });
    });
  });

  describe('Message Search', () => {
    describe('GET /api/patient-portal/messages/search', () => {
      beforeEach(async () => {
        // Create additional messages for search testing
        await Message.create({
          threadId: testThread._id,
          senderId: testPharmacist._id,
          senderType: 'pharmacist',
          content: 'Your medication dosage should be taken twice daily.',
          messageType: 'text',
          workplaceId: testWorkplace._id,
          isRead: true,
          readBy: [testPatientUser._id]
        });

        await Message.create({
          threadId: testThread._id,
          senderId: testPatientUser._id,
          senderType: 'patient',
          content: 'What are the side effects of this prescription?',
          messageType: 'text',
          workplaceId: testWorkplace._id,
          isRead: false,
          readBy: []
        });
      });

      it('should search messages by content', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/messages/search?q=medication')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.messages.length).toBeGreaterThan(0);
        
        // All returned messages should contain the search term
        response.body.data.messages.forEach((message: any) => {
          expect(message.content.toLowerCase()).toContain('medication');
        });
      });

      it('should filter search by date range', async () => {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 1);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 1);

        const response = await request(testApp)
          .get(`/api/patient-portal/messages/search?q=medication&fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should filter search by sender type', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/messages/search?q=medication&senderType=pharmacist')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        
        // All returned messages should be from pharmacist
        response.body.data.messages.forEach((message: any) => {
          expect(message.senderType).toBe('pharmacist');
        });
      });

      it('should return empty results for non-matching search', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/messages/search?q=nonexistentterm')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(0);
      });

      it('should paginate search results', async () => {
        // Create many messages with search term
        for (let i = 1; i <= 10; i++) {
          await Message.create({
            threadId: testThread._id,
            senderId: testPatientUser._id,
            senderType: 'patient',
            content: `Search result message ${i} about medication`,
            messageType: 'text',
            workplaceId: testWorkplace._id,
            isRead: false,
            readBy: []
          });
        }

        const response = await request(testApp)
          .get('/api/patient-portal/messages/search?q=medication&limit=5&page=1')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data.messages).toHaveLength(5);
        expect(response.body.data.pagination.totalPages).toBeGreaterThan(1);
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should apply rate limiting to message sending', async () => {
      const messageData = {
        content: 'Rate limit test message',
        messageType: 'text'
      };

      // Make multiple message requests quickly
      const requests = Array(20).fill(null).map(() => 
        request(testApp)
          .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(messageData)
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should sanitize message content', async () => {
      const maliciousData = {
        content: '<script>alert("xss")</script>Clean message content',
        messageType: 'text'
      };

      const response = await request(testApp)
        .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.content).not.toContain('<script>');
      expect(response.body.data.content).toContain('Clean message content');
    });

    it('should validate workspace context for messaging', async () => {
      // Create thread in different workplace
      const differentWorkplace = await Workplace.create({
        name: 'Different Pharmacy',
        email: 'admin@different.com',
        phone: '+2348012345679',
        address: '789 Different Street, Lagos, Nigeria',
        state: 'Lagos',
        lga: 'Ikeja',
        licenseNumber: 'PCN-DIFF-001',
        isActive: true,
        subscriptionStatus: 'active'
      });

      const differentPharmacist = await User.create({
        firstName: 'Different',
        lastName: 'Pharmacist',
        email: 'different@pharmacy.com',
        password: 'password123',
        role: 'pharmacist',
        workplaceId: differentWorkplace._id,
        isEmailVerified: true,
        status: 'active'
      });

      const differentThread = await MessageThread.create({
        participants: [
          {
            userId: testPatientUser._id,
            userType: 'patient',
            name: `${testPatient.firstName} ${testPatient.lastName}`
          },
          {
            userId: differentPharmacist._id,
            userType: 'pharmacist',
            name: `${differentPharmacist.firstName} ${differentPharmacist.lastName}`
          }
        ],
        workplaceId: differentWorkplace._id, // Different workplace
        subject: 'Cross-workplace thread',
        status: 'active',
        priority: 'normal',
        lastActivity: new Date(),
        createdBy: testPatientUser._id
      });

      // Try to send message to different workplace thread
      const messageData = {
        content: 'Cross-workplace message',
        messageType: 'text'
      };

      await request(testApp)
        .post(`/api/patient-portal/messages/threads/${differentThread._id}/messages`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send(messageData)
        .expect(404); // Should not find thread in patient's workplace
    });

    it('should prevent message injection attacks', async () => {
      const injectionData = {
        content: 'Normal message',
        messageType: 'text',
        senderId: new mongoose.Types.ObjectId(), // Try to override sender
        senderType: 'pharmacist' // Try to impersonate pharmacist
      };

      const response = await request(testApp)
        .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send(injectionData)
        .expect(201);

      // Should use authenticated user's ID and type
      expect(response.body.data.senderId).toBe(testPatientUser._id.toString());
      expect(response.body.data.senderType).toBe('patient');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid thread IDs', async () => {
      const invalidId = 'invalid-object-id';
      
      await request(testApp)
        .get(`/api/patient-portal/messages/threads/${invalidId}`)
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(testApp)
        .post(`/api/patient-portal/messages/threads/${testThread._id}/messages`)
        .set('Cookie', `patientToken=${patientToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle database connection errors gracefully', async () => {
      // Simulate database error by closing connection temporarily
      await mongoose.connection.close();

      const response = await request(testApp)
        .get('/api/patient-portal/messages/threads')
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('error');

      // Reconnect for cleanup
      const mongoUri = mongoServer.getUri();
      await mongoose.connect(mongoUri);
    });
  });

  describe('Performance', () => {
    it('should handle large message threads efficiently', async () => {
      // Create many messages in thread
      const messages = [];
      for (let i = 0; i < 200; i++) {
        messages.push({
          threadId: testThread._id,
          senderId: i % 2 === 0 ? testPatientUser._id : testPharmacist._id,
          senderType: i % 2 === 0 ? 'patient' : 'pharmacist',
          content: `Performance test message ${i}`,
          messageType: 'text',
          workplaceId: testWorkplace._id,
          isRead: false,
          readBy: [],
          createdAt: new Date(Date.now() + i * 1000)
        });
      }
      
      await Message.insertMany(messages);

      const startTime = Date.now();
      
      const response = await request(testApp)
        .get(`/api/patient-portal/messages/threads/${testThread._id}?messageLimit=50`)
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.data.messages).toHaveLength(50);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});