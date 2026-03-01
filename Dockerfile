# Stage 1: Install production dependencies
FROM node:20-alpine AS builder

WORKDIR /app

COPY app/package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Stage 2: Runtime image
FROM node:20-alpine AS runtime

# Create non-root user and group
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production deps from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source only
COPY app/src ./src
COPY app/package.json ./

# Set correct ownership
RUN chown -R appuser:appgroup /app

# Drop root - run as non-root user
USER appuser

# Runtime config only - no secrets
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Expose only the app port
EXPOSE 3000

# Use wget (built into alpine) - no extra packages needed
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Correct array format - no debugger, no root
CMD ["node", "src/index.js"]
