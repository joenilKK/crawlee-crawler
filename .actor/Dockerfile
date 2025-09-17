FROM apify/actor-node:20

# Copy source code
COPY . ./

# Install dependencies
RUN npm install --only=prod

# Run the actor
CMD ["npm", "start"]
