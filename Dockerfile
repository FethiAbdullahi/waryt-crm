# ---- Build Stage ----
    FROM node:20-alpine AS builder

    WORKDIR /app
    
    # Install pnpm
    RUN npm install -g pnpm
    
    # Copy dependency manifests
    COPY package.json pnpm-lock.yaml* ./
    # pnpm-lock.yaml is optional, so we use a wildcard
    
    # Install dependencies
    RUN pnpm install
    
    # Copy the rest of the application
    COPY . .
    
    # Set build-time environment variables

    ARG NODE_ENV
    ARG NEXT_PUBLIC_BASE_URL
    ARG NEXT_PUBLIC_SUPABASE_URL
    ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
    ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    
    
    ARG SP_XML_METADATA
    ARG IDP_XML_METADATA
    
    ENV NODE_ENV=${NODE_ENV}
    ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
    ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
    ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
    ENV SP_XML_METADATA=${SP_XML_METADATA}
    ENV IDP_XML_METADATA=${IDP_XML_METADATA}
    
    
    
    # Ensure public directory exists (create empty one if it doesn't)
    RUN mkdir -p public
    
    # Build the Next.js app
    RUN pnpm run build
    
    # ---- Production Stage ----
    FROM node:20-alpine AS runner
    
    WORKDIR /app
    
    # Set environment variables
    ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
    
    # Use a non-root user for security
    RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
    USER nextjs
    
    # Copy the standalone output from the builder stage
    COPY --from=builder /app/.next/standalone ./
    COPY --from=builder --chown=nextjs:nodejs /app/public ./public
    COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
    
    
    # Expose port 3000
    EXPOSE 3000
    
    # Set the port environment variable for Cloud Run
    ENV PORT=3000
    
    # Start the Next.js app
    CMD ["node", "server.js"]