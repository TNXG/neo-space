# TNXG Blog Backend

Rocket.rs backend API for the TNXG Blog, providing RESTful endpoints for posts, notes, categories, and friend links.

## Features

- 🚀 Built with Rocket.rs (Rust web framework)
- 🗄️ MongoDB integration
- 📄 Standardized API response format
- 📊 Pagination support for list endpoints
- 🔒 CORS enabled for frontend communication
- 🎯 Extensible architecture

## Configuration

Edit `Rocket.toml` to configure:

```toml
[default]
port = 8000
address = "0.0.0.0"

[default.databases]
mongodb_uri = "mongodb://localhost:27017/mx-space"
```

## API Endpoints

All responses follow this structure:

```typescript
interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T;
}
```

### Posts

- `GET /api/posts?page=1&size=10` - List published posts (paginated)
- `GET /api/posts/:id` - Get post by ID
- `GET /api/posts/slug/:slug` - Get post by slug

### Notes (Diary)

- `GET /api/notes?page=1&size=10` - List published notes (paginated)
- `GET /api/notes/:id` - Get note by ID

### Categories

- `GET /api/categories` - List all categories

### Links (Friends)

- `GET /api/links?page=1&size=10` - List approved friend links (paginated)

### Activities

- `GET /api/activities?limit=10` - List recent activities

## Development

```bash
# Build the project
cargo build

# Run in development mode
cargo run

# Run with release optimizations
cargo run --release
```

The server will start on `http://localhost:8000` by default.

## Project Structure

```
backend/
├── src/
│   ├── main.rs           # Application entry point
│   ├── db.rs             # Database connection
│   ├── models.rs         # Data models and API responses
│   └── routes/           # Route handlers
│       ├── mod.rs
│       ├── posts.rs
│       ├── notes.rs
│       ├── categories.rs
│       ├── links.rs
│       └── activities.rs
├── Cargo.toml            # Dependencies
└── Rocket.toml           # Configuration
```
