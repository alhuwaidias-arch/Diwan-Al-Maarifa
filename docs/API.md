# Diwan Al-Maarifa - API Documentation

**Date**: December 15, 2025

---

## 1. Base URL

`https://diwan-maarifa-backend.onrender.com/api`

## 2. Authentication

All private endpoints require a `Bearer` token in the `Authorization` header.

`Authorization: Bearer <your_jwt_token>`

## 3. Endpoints

### Auth

-   `POST /auth/register`: Register a new user.
-   `POST /auth/login`: Log in and receive a JWT token.

### Content

-   `GET /content`: Get published content (paginated).
-   `GET /content/:id`: Get a single piece of published content.
-   `POST /content/submit`: Submit new content (requires authentication).

### Categories

-   `GET /categories`: Get all scientific categories.

### Uploads

-   `POST /upload/image`: Upload a single image (requires authentication).
-   `POST /upload/document`: Upload a single document (requires authentication).
-   `POST /upload/multiple`: Upload multiple files (requires authentication).
-   `POST /upload/link`: Link uploaded files to a content submission (requires authentication).
-   `DELETE /upload/:id`: Delete an uploaded file (requires authentication).

For detailed request and response formats, please refer to the backend source code.
