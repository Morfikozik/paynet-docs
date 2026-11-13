# Paynet API documentation portal — runtime image.
# Build the site first (GitLab CI job docs-build or: node scripts/build-site.mjs --site-url https://docs.paynet.md/api/ --out dist --strict),
# then:  docker build -t paynet-docs .   and   docker run -d -p 8080:80 paynet-docs   → http://<host>:8080/api/
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/api/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/api/ > /dev/null || exit 1
