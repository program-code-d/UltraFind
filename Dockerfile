# Use Node 18 as the base
FROM node:18-bullseye-slim

# Install MariaDB and procps (required for service management)
RUN apt-get update && \
    apt-get install -y mariadb-server procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create a robust startup script
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting MariaDB..."\n\
service mariadb start\n\
echo "Waiting for MariaDB to be ready..."\n\
for i in {1..30}; do\n\
  if mariadb -u root -e "SELECT 1" > /dev/null 2>&1; then\n\
    echo "MariaDB is ready!"\n\
    break\n\
  fi\n\
  echo "Attempt $i/30 - MariaDB not ready yet, waiting..."\n\
  sleep 2\n\
done\n\
echo "Setting up database..."\n\
mariadb -u root -e "CREATE DATABASE IF NOT EXISTS test;"\n\
mariadb -u root -e "CREATE USER IF NOT EXISTS '"'"'appuser'"'"'@'"'"'localhost'"'"' IDENTIFIED BY '"'"'chicken55441'"'"';"\n\
mariadb -u root -e "GRANT ALL PRIVILEGES ON test.* TO '"'"'appuser'"'"'@'"'"'localhost'"'"'; FLUSH PRIVILEGES;"\n\
echo "Database setup complete!"\n\
exec npm start' > start.sh && chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]