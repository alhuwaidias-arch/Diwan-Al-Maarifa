# Diwan Al-Maarifa - Frontend

This repository contains the frontend code for the Diwan Al-Maarifa platform. It is a static website built with HTML, CSS, and JavaScript, and is hosted on GitHub Pages.

## Features

-   Browse and read scientific articles and terms.
-   User registration and login.
-   Content submission form with file uploads.
-   Dynamic rendering of content from the backend API.

## Development

To run the frontend locally, you can use a simple HTTP server:

```bash
python3 -m http.server
```

Then, open your browser to `http://localhost:8000`.

## Deployment

The frontend is automatically deployed to GitHub Pages whenever changes are pushed to the `main` branch.

## Project Structure

```
Diwan-Al-Maarifa/
├── docs/                        # Documentation
│   ├── API.md                   # API documentation
│   └── ARCHITECTURE.md          # System architecture
├── assets/                      # Static assets
│   ├── images/
│   ├── fonts/
│   └── icons/
├── index.html                   # Main page
├── api-client.js               # API client
├── auth.js                     # Authentication
├── file-upload.js              # File upload handler
├── forms-backend.js            # Form handling
├── search.js                   # Search functionality
├── script.js                   # Main scripts
├── styles.css                  # Styles
└── README.md                   # Project overview
```
