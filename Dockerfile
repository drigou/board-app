FROM node:22-alpine AS build
WORKDIR /app
# Optional extra root certificates (corporate HTTPS proxy), see certs/README.md.
COPY certs/ /tmp/certs/
RUN cat /tmp/certs/*.crt /tmp/certs/*.pem > /usr/local/share/extra-ca.pem 2>/dev/null; \
    echo "Extra CA certificates: $(grep -c 'BEGIN CERTIFICATE' /usr/local/share/extra-ca.pem)"
ENV NODE_EXTRA_CA_CERTS=/usr/local/share/extra-ca.pem
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --loglevel=http
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "build"]
