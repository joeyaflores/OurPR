# OurPR

OurPR is a web application designed to help runners discover races that fit their goals and track their personal records (PRs). It leverages AI to provide insights and personalized race suggestions.

## Project Structure

This repository contains two main parts:

*   `frontend/`: A Next.js application built with React and TypeScript, providing the user interface.
*   `backend/`: A FastAPI application built with Python, handling data, business logic, and AI integration.

## Getting Started

### Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   Python (v3.9 or later recommended)
*   pip
*   Supabase account and project credentials (`SUPABASE_URL`, `SUPABASE_KEY`)
*   Google Gemini API Key (`GEMINI_API_KEY`)

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/joeyaflores/OurPR.git
    cd OurPR
    ```

2.  **Backend Setup:**
    *   Navigate to the backend directory: `cd backend`
    *   Create a virtual environment (optional but recommended):
        ```bash
        python -m venv venv
        source venv/bin/activate # On Windows use `venv\Scripts\activate`
        ```
    *   Install dependencies: `pip install -r requirements.txt`
    *   Create a `.env` file by copying `.env.example` (if one exists) or create it manually. Add your `SUPABASE_URL`, `SUPABASE_KEY`, and `GEMINI_API_KEY`.
    *   (Optional) Apply database migrations if schema changes are needed (Refer to `backend/supabase/schema.sql`).

3.  **Frontend Setup:**
    *   Navigate to the frontend directory: `cd ../frontend`
    *   Install dependencies: `npm install` (or `yarn install`)
    *   Create a `.env.local` file. You'll likely need to add Supabase credentials here as well for the client-side Supabase library, typically prefixed like `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Check the frontend code for the exact variable names needed.

### Running the Application

1.  **Run the Backend:**
    *   Make sure you are in the `backend/` directory.
    *   Activate your virtual environment if you created one.
    *   Start the FastAPI server:
        ```bash
        uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
        ```
        (Adjust host and port as needed)

2.  **Run the Frontend:**
    *   Make sure you are in the `frontend/` directory.
    *   Start the Next.js development server:
        ```bash
        npm run dev
        ```
        (or `yarn dev`)
    *   Open your browser to `http://localhost:3000` (or the port specified by Next.js).

## Technology Stack

*   **Frontend:** Next.js, React, TypeScript, Tailwind CSS, ShadCN/ui, React Leaflet
*   **Backend:** FastAPI, Python, Pydantic
*   **Database:** Supabase (PostgreSQL)
*   **AI:** Google Gemini
*   **Deployment:** (Not specified yet)

## Contributing

Contributions are welcome! Please follow standard fork & pull request workflows.

## License

(Specify License - e.g., MIT License) 