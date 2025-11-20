# Multi-stage Dockerfile for PharmacyCopilot SaaS Settings Module

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install dependencies
RUN npm ci --only=production --ignore-scripts
RUN cd backend && npm ci --only=production --ignore-scripts
RUN cd frontend && npm ci --only=production --ignore-scripts

# Copy source code
COPY . .

# Build backend
WORKDIR /app/backend
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S PharmacyCopilot -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=PharmacyCopilot:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=PharmacyCopilot:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=PharmacyCopilot:nodejs /app/backend/package*.json ./backend/
COPY --from=builder --chown=PharmacyCopilot:nodejs /app/frontend/dist ./frontend/dist
COPY --from=builder --chown=PharmacyCopilot:nodejs /app/package*.json ./

# Copy configuration files
COPY --chown=PharmacyCopilot:nodejs ecosystem.config.js ./
COPY --chown=PharmacyCopilot:nodejs healthcheck.js ./

# Create necessary directories with proper permissions
RUN mkdir -p /var/log/PharmacyCopilot /var/lib/PharmacyCopilot/uploads /var/lib/PharmacyCopilot/temp && \
    chown -R PharmacyCopilot:nodejs /var/log/PharmacyCopilot /var/lib/PharmacyCopilot

# Switch to non-root user
USER PharmacyCopilot

# Expose application port
EXPOSE 3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/dist/server.js"]