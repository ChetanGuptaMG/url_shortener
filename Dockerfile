FROM node:16-slim

# Set working directory
WORKDIR /app

COPY package*.json ./

# Install dependencies
RUN npm install

COPY . .

EXPOSE 3000


# Run the application
CMD ["node", "src/app.js"]
