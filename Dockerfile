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
service mariadb start\n\
until mariadb -u root -e "status" > /dev/null 2>&1; do\n\
  echo "Waiting for MariaDB..."\n\
  sleep 2\n\
done\n\
mariadb -u root -e "CREATE DATABASE IF NOT EXISTS test;"\n\
mariadb -u root -e "ALTER USER '"'"'root'"'"'@'"'"'localhost'"'"' IDENTIFIED BY '"'"'chicken55441'"'"'; FLUSH PRIVILEGES;"\n\
exec npm start' > start.sh && chmod +x start.sh

EXPOSE 8080

CMD ["./start.sh"]