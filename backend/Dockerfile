# backend/Dockerfile
# Builds a production container for the OOTD backend.
#
# Test it locally:
#   cd backend
#   docker build -t ootd-backend .
#   docker run --env-file .env -p 3001:3001 ootd-backend
# Then check http://localhost:3001/api/health

FROM node:20-alpine

WORKDIR /app

# Copy just the manifest first so Docker can cache the npm install layer —
# this file rarely changes, so rebuilds after editing code stay fast.
COPY package*.json ./
RUN npm install --omit=dev

# Now copy the actual source.
COPY . .

EXPOSE 3001

CMD ["node", "server.js"]