# URL Shortener and Analytics Platform

A robust URL shortening service with comprehensive analytics, built with Node.js and Express. This platform provides secure URL shortening capabilities along with detailed usage analytics, making it perfect for tracking and analyzing link engagement.

## Features

### Core Functionality
- **URL Shortening**
  - Custom alias support
  - QR code generation
  - Topic/category tagging
  - Expiration date setting

### Authentication & Security
- Google OAuth2 integration
- Rate limiting protection
- Secure API endpoints
- Role-based access control

### Analytics & Tracking
- Comprehensive click tracking
- Geographic location data
- Device and browser analytics
- Time-based usage patterns
- Topic-based analytics
- Real-time statistics

### Performance
- Redis caching implementation
- High-performance URL redirection
- Scalable architecture
- Load balancing ready

## Technical Stack

- **Backend**: Node.js, Express
- **Database**: MongoDB
- **Caching**: Redis
- **Authentication**: Google OAuth2
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker
- **Testing**: Jest

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- Docker (for containerized deployment)
- Google OAuth2 credentials

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/url-shortener.git
   cd url-shortener
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration:
   - MongoDB connection string
   - Redis connection details
   - Google OAuth credentials
   - JWT secret
   - API rate limits

4. Start the development server:
   ```bash
   npm run dev
   ```

## API Documentation

Once the server is running, access the API documentation at:
```
http://localhost:3000/docs
```

### API Endpoints Summary

#### URL Operations
- `POST /api/url/shorten` - Create a shortened URL  
  Example request body:
  ```json
  {
    "longUrl": "https://example.com/very-long-url",
    "customAlias": "my-custom-alias",      // optional
    "topic": "marketing"                   // optional
  }
  ```
- `GET /api/url/my-urls` - Retrieve URLs created by the authenticated user
- `GET /api/url/by-topic/{topic}` - Retrieve URLs for a given topic
- `GET /api/shorten/{alias}` - Redirect to the original URL and track analytics

#### Analytics
- `GET /api/analytics/url/{urlId}` - Get analytics for a specific URL
- `GET /api/analytics/topic/{topic}` - Get topic-based analytics with breakdowns
- `GET /api/analytics/overall` - Get overall system analytics
- `GET /api/analytics/{shortCode}` - Get detailed analytics for a URL (by short code)

#### Authentication
- `GET /api/auth/google` - Initiate Google OAuth2 authentication
- `GET /api/auth/google/callback` - OAuth2 callback handler
- `GET /api/auth/status` - Check the authentication status
- `GET /api/auth/logout` - Logout user

### Usage Examples

1. Create a shortened URL:
   ```bash
   curl -X POST http://localhost:3000/api/url/shorten \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "longUrl": "https://example.com/very-long-url",
       "customAlias": "my-link"
     }'
   ```

2. Get analytics for a URL:
   ```bash
   curl http://localhost:3000/api/analytics/url/URL_ID \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

3. Redirect to the original URL:
   ```bash
   curl -L http://localhost:3000/api/shorten/my-link
   ```

## Deployment

### Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t url-shortener .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 url-shortener
   ```

### Manual Deployment

1. Set up production environment variables
2. Build the application:
   ```bash
   npm run build
   ```

3. Start the production server:
   ```bash
   npm start
   ```

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

## Acknowledgments

- Built with ❤️ using Node.js and Express
