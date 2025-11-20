# Chat Models - Communication Module Rebuild

This directory contains the simplified data models for the rebuilt communication module.

## Overview

These models replace the overly complex original models with a cleaner, more maintainable structure while preserving all essential functionality.

## Models

### 1. Conversation (`Conversation.ts`)

**Purpose:** Manages chat conversations (direct, group, patient queries, prescription discussions, broadcasts)

**Key Simplifications:**
- Removed complex nested permissions (using role-based access instead)
- Simplified metadata structure
- Removed encryption complexity (handled at service layer)
- Cleaner participant structure with only 4 roles: pharmacist, doctor, patient, admin

**Key Features:**
- Support for 5 conversation types
- Participant management (add/remove)
- Unread count tracking per user
- Pin and archive functionality
- Last message preview

**Indexes:**
- Compound index on `workplaceId`, `participants.userId`, `updatedAt`
- Index on `patientId` and `prescriptionId` for healthcare-specific queries
- Text index on `title` for search

### 2. Message (`Message.ts`)

**Purpose:** Stores individual messages within conversations

**Key Simplifications:**
- Removed complex encryption metadata
- Simplified reaction structure (grouped by emoji)
- Cleaner edit tracking (boolean flag + timestamp instead of full history)
- Removed excessive validation complexity

**Key Features:**
- Support for text, file, image, and system messages
- Threaded replies (threadId, parentMessageId)
- Reactions with emoji grouping
- Read receipts
- Mentions
- Edit within 15-minute window
- Soft delete

**Indexes:**
- Compound index on `conversationId`, `createdAt`
- Index on `threadId` for threaded conversations
- Text index on `content.text` for search

### 3. FileMetadata (`FileMetadata.ts`)

**Purpose:** Tracks files uploaded in conversations

**Key Features:**
- File information (name, size, mime type)
- S3 storage details
- Virus scanning status
- Thumbnail URLs for images
- File type validation (images, PDFs, documents, audio)
- 10MB size limit

**Allowed File Types:**
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, Word, Excel, Plain text, CSV
- Audio: MP3, WAV, OGG

**Indexes:**
- Compound index on `conversationId`, `uploadedAt`
- Index on `isScanned` and `scanResult` for security

### 4. Presence (`Presence.ts`)

**Purpose:** Tracks user online/offline status and custom status messages

**Storage:** Redis (for fast access and automatic TTL cleanup)

**Key Features:**
- Online/away/offline status
- Custom status messages with emoji
- Multiple socket connections (desktop + mobile)
- Last seen timestamp
- Automatic cleanup with TTL (5 minutes for online, 24 hours for offline)

**Redis Keys:**
- `presence:{userId}` - User presence data
- `custom_status:{userId}` - Custom status message
- `socket:{userId}` - Set of active socket IDs

## Usage Examples

### Creating a Conversation

```typescript
import { ChatConversation } from './models/chat';

const conversation = new ChatConversation({
  type: 'direct',
  participants: [
    { userId: pharmacistId, role: 'pharmacist' },
    { userId: patientId, role: 'patient' },
  ],
  workplaceId,
});

await conversation.save();
```

### Sending a Message

```typescript
import { ChatMessage } from './models/chat';

const message = new ChatMessage({
  conversationId,
  senderId,
  content: {
    text: 'Hello, how can I help you?',
    type: 'text',
  },
  workplaceId,
});

await message.save();
```

### Tracking Presence

```typescript
import { getPresenceModel } from './models/chat';

const presenceModel = getPresenceModel();

// Set user online
await presenceModel.setUserOnline(userId, socketId);

// Get user presence
const presence = await presenceModel.getUserPresence(userId);

// Set custom status
await presenceModel.setCustomStatus(userId, {
  text: 'In a meeting',
  emoji: '📅',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour
});
```

### Uploading a File

```typescript
import { ChatFileMetadata } from './models/chat';

const fileMetadata = new ChatFileMetadata({
  conversationId,
  messageId,
  uploadedBy,
  fileName: 'prescription.pdf',
  fileSize: 1024 * 500, // 500KB
  mimeType: 'application/pdf',
  s3Bucket: 'my-bucket',
  workplaceId,
});

await fileMetadata.save();

// Mark as scanned
fileMetadata.markAsScanned('clean');
await fileMetadata.save();
```

## Testing

All models have comprehensive unit tests in the `__tests__` directory:

- `Conversation.test.ts` - Tests for conversation model
- `Message.test.ts` - Tests for message model
- `FileMetadata.test.ts` - Tests for file metadata model
- `Presence.test.ts` - Tests for presence model (Redis)

Run tests with:
```bash
npm test -- models/chat
```

## Migration from Old Models

The old models (`Conversation.ts` and `Message.ts` in `backend/src/models/`) are still in place. The new models use different collection names:

- Old: `conversations` → New: `chatconversations`
- Old: `messages` → New: `chatmessages`
- New: `chatfilemetadata` (separate from messages)

This allows for gradual migration without breaking existing functionality.

## Key Differences from Old Models

### Removed Complexity:
1. ❌ Complex nested permissions array (9 different permissions)
2. ❌ Encryption metadata in models (moved to service layer)
3. ❌ Full edit history (simplified to boolean + timestamp)
4. ❌ Complex clinical context metadata
5. ❌ Excessive validation rules

### Added Simplicity:
1. ✅ Role-based access (4 roles instead of 8)
2. ✅ Cleaner participant structure
3. ✅ Grouped reactions by emoji
4. ✅ Separate file metadata model
5. ✅ Redis-based presence for performance

### Preserved Functionality:
1. ✅ All conversation types
2. ✅ Threaded replies
3. ✅ Reactions and read receipts
4. ✅ File attachments
5. ✅ Search capabilities
6. ✅ Soft delete
7. ✅ Audit trail (timestamps)

## Performance Considerations

1. **Indexes:** All models have optimized compound indexes for common queries
2. **Pagination:** Static methods support limit/offset for large datasets
3. **Virtual Scrolling:** Models designed to work with virtual scrolling in UI
4. **Caching:** Presence data in Redis with automatic TTL
5. **Bulk Operations:** Support for bulk presence queries

## Security

1. **File Validation:** Strict mime type and size validation
2. **Virus Scanning:** File metadata tracks scan status
3. **Role-Based Access:** Simplified 4-role system
4. **Soft Delete:** Messages can be deleted without losing structure
5. **Audit Trail:** All models track creation timestamps

## Next Steps

After completing the models:
1. ✅ Task 1.1: Conversation model - COMPLETE
2. ✅ Task 1.2: Message model - COMPLETE
3. ✅ Task 1.3: FileMetadata model - COMPLETE
4. ✅ Task 1.4: Presence model - COMPLETE
5. ⏭️ Task 2.1: Implement ChatService - Conversation Management
6. ⏭️ Task 2.2: Implement ChatService - Message Operations
7. ⏭️ Task 2.3: Implement ChatService - Reactions and Read Receipts

## Contributing

When modifying these models:
1. Update tests in `__tests__` directory
2. Update this README if adding new features
3. Maintain backward compatibility where possible
4. Follow the simplification principles
5. Add indexes for new query patterns

## Questions?

Refer to:
- Design document: `.kiro/specs/communication-module-rebuild/design.md`
- Requirements: `.kiro/specs/communication-module-rebuild/requirements.md`
- Tasks: `.kiro/specs/communication-module-rebuild/tasks.md`
