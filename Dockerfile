FROM node:22-alpine
WORKDIR /app
RUN mkdir -p /data && chown node:node /data
COPY package.json LICENSE manifest.webmanifest .nojekyll ./
COPY index.html privacy.html terms.html styles.css dark.css legal.css ./
COPY app.js theme.js workspace-model.js selection-preview.js boundary-fill.js mandala-tools.js mandala-art.js creative-tools.js native-file.js cloud-drive.js notebook-sharing.js shared-notebook-model.js live-sync.js google-config.js pdf-export.js pdf-import.js clipboard.js text-tools.js interaction-tools.js eraser-preview.js page-stack.js sw.js ./
COPY server/start.mjs server/google-auth.mjs server/live-relay.mjs ./server/
COPY assets/ ./assets/
COPY examples/ ./examples/
COPY vendor/pdfjs/ ./vendor/pdfjs/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 WINDS_SESSION_FILE=/data/sessions.enc WINDS_LIVE_SYNC=true
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/start.mjs"]
