# Multi-stage build for optimized production image
# Stage 1: Dependencies
FROM node:20-alpine AS dependencies

WORKDIR /build

# Copy package files for better layer caching
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including dev for building)
RUN npm ci && \
    cd frontend && npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /build

# Copy dependencies from previous stage
COPY --from=dependencies /build/node_modules ./node_modules
COPY --from=dependencies /build/frontend/node_modules ./frontend/node_modules

# Copy source code
COPY . .

# Build frontend
RUN cd frontend && npm run build

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Stage 3: Production Runtime
FROM node:20-alpine AS production

# Add labels for better container management
LABEL maintainer="SommOS Team" \
      version="1.0.0" \
      description="SommOS - AI-Powered Yacht Wine Management System"

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1001 -S sommuser && \
    adduser -S sommuser -u 1001 -G sommuser

# Copy only necessary files from builder
COPY --from=builder --chown=sommuser:sommuser /build/node_modules ./node_modules
COPY --from=builder --chown=sommuser:sommuser /build/backend ./backend
COPY --from=builder --chown=sommuser:sommuser /build/frontend/dist ./frontend/dist
COPY --from=builder --chown=sommuser:sommuser /build/frontend/public ./frontend/public
COPY --from=builder --chown=sommuser:sommuser /build/package*.json ./

# Create data and logs directories
RUN mkdir -p /usr/src/app/data /usr/src/app/logs && \
    chown -R sommuser:sommuser /usr/src/app

# Switch to non-root user
USER sommuser

# Expose port
EXPOSE 3000

# Environment defaults
ENV NODE_ENV=production \
    PORT=3000

# Enhanced health check with better timing
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/system/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "backend/server.js"]
