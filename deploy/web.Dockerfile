# LunaScope web app (Next.js BFF + UI). Build from the repository root:
#   docker build -f deploy/web.Dockerfile -t lunascope-web .
# SCIENCE_API_URL and SCIENCE_API_TOKEN are read at request time and never sent to the browser.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
# public/ holds no files today (git does not track an empty folder); keep the COPY below valid either way
RUN mkdir -p public

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# full node_modules from the build stage: next.config.ts is evaluated at start, and a pruned
# production install is the likelier way for that to fail (this image has not been built yet)
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/.next .next
COPY --from=build /app/public public
COPY --from=build /app/next.config.ts ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "next", "start", "--port", "3000"]
