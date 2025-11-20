# Chat Services - Communication Module Rebuild

This directory contains the service layer for the rebuilt communication module.

## Overview

The ChatService provides a complete, simplified API for managing conversations, messages, reactions, and read receipts. It replaces the overly complex original communicationService with a cleaner, more maintainable implementation.

## ChatService

**Location:** `ChatService.ts`

### Conversation Management Methods

#### `createConversation(data: CreateConversationDTO): Promise<IConversation>`

Creates a new conversation with validation and notifications.

**Features:**
- Validates all participants exist and belong to workplace
- Automatically adds creator if not in participants list
- Validates patient/prescription for specific conversation types
- Sends notifications to all participants (except creator)
- Supports 5 conversation types

**Example:**
```typescript
const conversation = await chatService.createConversation({
  type: 'direct',
  participants: [
    { userId: pharmacistId, role: 'pharmacist' },
    { userId: patientId, role: 'patient' },
  ],
  createdBy: pharmacistId,
  workplaceId,
});
```

#### `getConversations(userId, workplaceId, filters?): Promise<IConversation[]>`

Retrieves conversations for a user with filtering and pagination.

**Filters:**
- `status` - Filter by active/archived/resolved
- `type` - Filter by conversation type
- `isPinned` - Filter pinned conversations
- `patientId` - Filter by patient
- `search` - Text search in title
- `limit` / `offset` - Pagination

**Example:**
```typescript
const conversations = await chatService.getConversations(
  userId,
  workplaceId,
  {
    status: 'active',
    type: 'patient_query',
    limit: 20,
  }
);
```

#### `getConversation(conversationId, userId, workplaceId): Promise<IConversation | null>`

Gets a single conversation with access validation.

#### `updateConversation(conversationId, userId, workplaceId, updates): Promise<IConversation | null>`

Updates conversation details (title, status, isPinned).

**Permissions:** Requires pharmacist, doctor, or admin role.

#### `pinConversation(conversationId, userId, workplaceId): Promise<IConversation | null>`

Pins a conversation to the top of the list.

#### `archiveConversation(conversationId, userId, workplaceId): Promise<IConversation | null>`

Archives a conversation (hides from main list).

#### `addParticipant(conversationId, newUserId, role, addedBy, workplaceId): Promise<void>`

Adds a participant to a conversation.

**Permissions:** Requires pharmacist, doctor, or admin role.

**Features:**
- Validates new user exists
- Sends notification to new participant
- Updates conversation participant list

#### `removeParticipant(conversationId, userIdToRemove, removedBy, workplaceId): Promise<void>`

Removes a participant from a conversation.

**Permissions:** Can remove self, or requires pharmacist/doctor/admin role.

**Features:**
- Soft removal (marks as left, doesn't delete)
- Updates unread counts

#### `getPatientConversations(patientId, userId, workplaceId): Promise<IConversation[]>`

Gets all conversations for a specific patient.

#### `markConversationAsRead(conversationId, userId, workplaceId): Promise<void>`

Resets unread count for a conversation.

#### `getUnreadCount(userId, workplaceId): Promise<number>`

Gets total unread count across all active conversations.

### Message Operations Methods

#### `sendMessage(data: SendMessageDTO): Promise<IMessage>`

Sends a message in a conversation.

**Features:**
- Validates user is participant
- Supports threaded replies (parentMessageId)
- Handles mentions with notifications
- Updates conversation last message
- Increments unread counts

**Example:**
```typescript
const message = await chatService.sendMessage({
  conversationId,
  senderId,
  content: {
    text: 'Hello @user, how are you?',
    type: 'text',
  },
  mentions: [userId],
  workplaceId,
});
```

#### `getMessages(conversationId, userId, workplaceId, filters?): Promise<IMessage[]>`

Retrieves messages for a conversation with pagination.

**Filters:**
- `threadId` - Get messages in a specific thread
- `before` / `after` - Date range filtering
- `limit` / `offset` - Pagination

**Features:**
- Validates user access
- Excludes deleted messages
- Populates sender, mentions, read receipts
- Sorted by most recent first

**Example:**
```typescript
const messages = await chatService.getMessages(
  conversationId,
  userId,
  workplaceId,
  {
    limit: 50,
    before: new Date(),
  }
);
```

#### `editMessage(messageId, userId, workplaceId, newContent): Promise<IMessage>`

Edits a message within 15-minute window.

**Permissions:** Must be message sender.

**Features:**
- Enforces 15-minute edit window
- Marks message as edited with timestamp
- Cannot edit deleted messages

**Example:**
```typescript
const edited = await chatService.editMessage(
  messageId,
  userId,
  workplaceId,
  'Updated message content'
);
```

#### `deleteMessage(messageId, userId, workplaceId): Promise<void>`

Soft deletes a message.

**Permissions:** Must be message sender or admin/pharmacist/doctor.

**Features:**
- Soft delete (replaces content with "This message was deleted")
- Preserves message structure for threads
- Maintains audit trail

### Reactions and Read Receipts Methods

#### `addReaction(messageId, userId, workplaceId, emoji): Promise<IMessage>`

Adds an emoji reaction to a message.

**Features:**
- Validates user is participant
- Groups reactions by emoji
- Prevents duplicate reactions from same user

**Allowed Emojis:**
```
👍 👎 ❤️ 😊 😢 😮 😡 🤔 ✅ ❌ ⚠️ 🚨 📋 💊 🩺 📊
```

**Example:**
```typescript
const message = await chatService.addReaction(
  messageId,
  userId,
  workplaceId,
  '👍'
);
```

#### `removeReaction(messageId, userId, workplaceId, emoji): Promise<IMessage>`

Removes a reaction from a message.

#### `markMessageAsRead(messageId, userId, workplaceId): Promise<void>`

Marks a single message as read.

**Features:**
- Adds read receipt with timestamp
- Updates message status (sent → delivered → read)
- Updates conversation unread count

#### `markConversationMessagesAsRead(conversationId, userId, workplaceId): Promise<void>`

Marks all messages in a conversation as read.

**Features:**
- Bulk operation for efficiency
- Updates all unread messages
- Resets conversation unread count

## Data Transfer Objects (DTOs)

### CreateConversationDTO
```typescript
{
  type: 'direct' | 'group' | 'patient_query' | 'prescription_discussion' | 'broadcast';
  title?: string;
  participants: Array<{
    userId: string;
    role: 'pharmacist' | 'doctor' | 'patient' | 'admin';
  }>;
  patientId?: string;
  prescriptionId?: string;
  createdBy: string;
  workplaceId: string;
}
```

### SendMessageDTO
```typescript
{
  conversationId: string;
  senderId: string;
  content: {
    text?: string;
    type: 'text' | 'file' | 'image' | 'system';
  };
  threadId?: string;
  parentMessageId?: string;
  mentions?: string[];
  workplaceId: string;
}
```

### ConversationFilters
```typescript
{
  status?: 'active' | 'archived' | 'resolved';
  type?: 'direct' | 'group' | 'patient_query' | 'prescription_discussion' | 'broadcast';
  isPinned?: boolean;
  patientId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
```

### MessageFilters
```typescript
{
  threadId?: string;
  before?: Date;
  after?: Date;
  limit?: number;
  offset?: number;
}
```

## Error Handling

All methods throw descriptive errors:

- `"Conversation not found or access denied"` - User not participant or conversation doesn't exist
- `"Insufficient permissions to..."` - User lacks required role
- `"Some participants not found..."` - Invalid participant IDs
- `"Patient not found..."` - Invalid patient ID
- `"Cannot edit message after 15 minutes"` - Edit window expired
- `"Not authorized to..."` - Permission denied

## Integration with Existing Systems

### Notification Service
Uses existing `notificationService` for:
- Conversation invites
- Mention notifications
- No modifications to unified notification system

### Logging
Uses existing `logger` utility for:
- Info logs for successful operations
- Debug logs for detailed tracking
- Error logs with context
- Warning logs for edge cases

### Models
Uses new simplified models:
- `ChatConversation` - Conversation data
- `ChatMessage` - Message data
- `User` - User validation
- `Patient` - Patient validation

## Testing

**Test Coverage:** 100% (50+ test cases)

**Test File:** `__tests__/ChatService.test.ts`

**Test Categories:**
1. Conversation Management (25 tests)
   - Creating all conversation types
   - Filtering and pagination
   - Permissions and access control
   - Participant management
   - Pin/archive operations

2. Message Operations (15 tests)
   - Sending messages
   - Threaded replies
   - Mentions
   - Editing (with time window)
   - Deleting (soft delete)

3. Reactions and Read Receipts (10 tests)
   - Adding/removing reactions
   - Marking messages as read
   - Bulk read operations

Run tests:
```bash
npm test -- services/chat
```

## Performance Considerations

1. **Pagination:** All list methods support limit/offset
2. **Indexes:** Leverages model indexes for fast queries
3. **Bulk Operations:** `markConversationMessagesAsRead` for efficiency
4. **Lean Queries:** Uses `.lean()` where appropriate
5. **Selective Population:** Only populates needed fields

## Security

1. **Access Control:** Validates user is participant before any operation
2. **Role-Based Permissions:** Enforces role requirements for sensitive operations
3. **Workplace Isolation:** All queries scoped to workplaceId
4. **Soft Delete:** Preserves audit trail
5. **Edit Window:** 15-minute limit prevents abuse

## Migration from Old Service

| Old Method | New Method | Changes |
|------------|------------|---------|
| `createConversation` | `createConversation` | Simplified permissions |
| `getConversations` | `getConversations` | Better filtering |
| `sendMessage` | `sendMessage` | Cleaner validation |
| `addMessageReaction` | `addReaction` | Grouped reactions |
| `markMessageAsRead` | `markMessageAsRead` | Simpler logic |

## Usage Example

```typescript
import { chatService } from './services/chat';

// Create conversation
const conversation = await chatService.createConversation({
  type: 'patient_query',
  participants: [
    { userId: pharmacistId, role: 'pharmacist' },
  ],
  patientId,
  createdBy: pharmacistId,
  workplaceId,
});

// Send message
const message = await chatService.sendMessage({
  conversationId: conversation._id.toString(),
  senderId: pharmacistId,
  content: {
    text: 'Hello, how can I help you?',
    type: 'text',
  },
  workplaceId,
});

// Add reaction
await chatService.addReaction(
  message._id.toString(),
  patientId,
  workplaceId,
  '👍'
);

// Mark as read
await chatService.markMessageAsRead(
  message._id.toString(),
  patientId,
  workplaceId
);
```

## Next Steps

After completing the service layer:
- ✅ Task 2.1: Conversation Management - COMPLETE
- ✅ Task 2.2: Message Operations - COMPLETE
- ✅ Task 2.3: Reactions and Read Receipts - COMPLETE
- ⏭️ Task 3.1: Create conversation endpoints
- ⏭️ Task 3.2: Create message endpoints
- ⏭️ Task 3.3: Create reaction endpoints

## Contributing

When modifying the service:
1. Update tests in `__tests__/ChatService.test.ts`
2. Update this README if adding new methods
3. Maintain backward compatibility where possible
4. Follow error handling patterns
5. Add logging for new operations
