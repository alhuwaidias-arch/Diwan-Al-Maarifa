# Diwan Al-Maarifa Backend Deployment Guide

This guide provides step-by-step instructions for deploying the Diwan Al-Maarifa backend API and PostgreSQL database on Render.

## Prerequisites

- A Render account
- A GitHub account with the `alhuwaidias-arch/Infirad-Diwan` repository forked or accessible.

## Deployment Steps

Follow these steps to deploy the application from scratch.

### Step 1: Create a New PostgreSQL Database

First, we will create the database that the application will use to store all its data.

1.  Log in to your Render Dashboard.
2.  Click the **New +** button and select **PostgreSQL**.
3.  Enter a **Name** for your database (e.g., `diwan-maarifa-db`).
4.  Select a **Region** that is geographically close to you for the best performance.
5.  Choose the **Free** plan for now.
6.  Click **Create Database**. Render will provision the database, which may take a few minutes.
7.  Once the database is created, go to its dashboard page. Under the **Connect** section, find the **Internal Database URL** and copy it. You will need this for the backend service.

### Step 2: Create a New Web Service

Next, we will deploy the backend API as a web service that connects to the database.

1.  In the Render Dashboard, click the **New +** button and select **Web Service**.
2.  Connect your GitHub account and select the `alhuwaidias-arch/Infirad-Diwan` repository.
3.  Enter a **Name** for your service (e.g., `diwan-maarifa-backend`).
4.  Set the **Root Directory** to `backend`.
5.  Render should automatically detect the following settings:
    - **Runtime**: `Node`
    - **Build Command**: `npm install`
    - **Start Command**: `node src/index.js`
6.  Choose the **Free** plan for the web service.
7.  Before creating the service, click **Advanced Settings** to configure environment variables.

### Step 3: Configure Environment Variables

Environment variables are used to store sensitive information like database credentials and other configuration settings.

1.  In the **Advanced Settings** section of your new web service, click **Add Environment Variable**.
2.  Add the following variable:
    - **Key**: `DATABASE_URL`
    - **Value**: Paste the **Internal Database URL** you copied from your PostgreSQL database in Step 1.
3.  Add another variable to set the environment:
    - **Key**: `NODE_ENV`
    - **Value**: `production`
4.  Click **Save Changes**.

### Step 4: Deploy and Verify

Now you are ready to deploy the application.

1.  Click the **Create Web Service** button.
2.  Render will start the deployment process, which involves cloning the repository, installing dependencies, and starting the server.
3.  Go to the **Logs** tab for your web service to monitor the deployment.
4.  You should see the following messages indicating a successful migration:
    ```
    🔄 Checking database schema...
    📦 Database schema not found. Running migration...
    📄 Using schema file from: /opt/render/project/src/backend/database/schema/01_create_tables.sql
    ✅ Database schema created successfully!
    📋 Created tables: analytics_events, categories, comments, content_submissions, notifications, published_content, user_sessions, users, workflow_history
    ✓ Database connected successfully
    ```
5.  Once you see the `Your service is live 🔥` message, the deployment is complete.

### Step 5: Testing the API

After a successful deployment, you can test the API to ensure everything is working correctly.

1.  **Health Check**: Open your browser and navigate to `https://<your-service-name>.onrender.com/health`. You should see a JSON response with `"status": "healthy"`.

2.  **Registration**: Use a tool like Postman or `curl` to send a POST request to the registration endpoint:

    - **URL**: `https://<your-service-name>.onrender.com/api/auth/register`
    - **Method**: `POST`
    - **Body** (JSON):
      ```json
      {
        "username": "testuser",
        "email": "test@example.com",
        "password": "password123",
        "full_name": "Test User",
        "role": "contributor"
      }
      ```

A successful registration should return a `201 Created` status and a JSON object with the new user details and a token.

---

If you encounter any issues, please review the logs in Render for error messages and double-check your environment variables.
