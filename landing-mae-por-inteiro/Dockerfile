FROM nginx:alpine

# Copiar arquivos estáticos da landing page
COPY . /usr/share/nginx/html/evento-mae-por-inteiro

# Configuração Nginx para servir com basePath correto
RUN echo 'server { \
    listen 8080; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    location /evento-mae-por-inteiro { \
        try_files $uri $uri/ /evento-mae-por-inteiro/index.html; \
        add_header Cache-Control "no-cache, must-revalidate"; \
    } \
    \
    location /evento-mae-por-inteiro/assets { \
        expires 30d; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
