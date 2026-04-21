# LAS Well Analyzer 🛢️

A comprehensive full-stack application designed for geoscientists and engineers to upload, parse, analyze, and visualize **Log ASCII Standard (LAS)** well files. The platform provides interactive visualization, statistical analysis, and an AI-powered (rule-based) chatbot for querying well log data.

## 🚀 Features

- **LAS File Processing**: Seamlessly upload and parse `.las` files. Extracts header metadata (Well Name, Depth Range, Step) and curve data.
- **Interactive Visualization**: Multi-curve plotting using **Plotly.js**. Compare multiple logs (up to 3) simultaneously with synchronized depth axes.
- **Cloud Integration**: Stores original LAS files in **AWS S3** for secure and scalable access.
- **Statistical Interpretation**:
  - Automatic calculation of Mean, Median, Std Dev, Min, and Max for selected curves.
  - Outlier/Spike detection using Interquartile Range (IQR).
  - Visualization of "cleaned" curves with anomalies removed.
- **Well Chatbot**: A dedicated sidebar to ask questions about the well logs (e.g., "What is the average Gamma Ray between 5000 and 5500 ft?").
- **Persistent Data**: Metadata and log values are indexed in **PostgreSQL** for high-performance retrieval.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 with TypeScript
- **Bundler**: Vite
- **Styling**: Tailwind CSS 4
- **Visualization**: Plotly.js
- **API Client**: Axios

### Backend
- **Runtime**: Node.js & Express with TypeScript
- **File Handling**: Multer (Memory Storage)
- **Database**: PostgreSQL (pg)
- **Storage**: AWS SDK v3 (S3 Client)
- **ID Generation**: UUID v4

---

## 📋 Prerequisites

- **Node.js**: v18+ recommended
- **PostgreSQL**: Local or cloud-hosted instance
- **AWS Account**: Access key and secret for an S3 bucket

---

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd LasFileAnalyser
```

### 2. Backend Configuration
Navigate to the `backend` directory and create a `.env` file:
```bash
cd backend
npm install
```

**`.env` Template:**
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=your_region (e.g., ap-south-1)
AWS_BUCKET_NAME=your_bucket_name
PORT=5050

# Database Configuration
DATABASE_URL=postgres://user:password@host:port/database  # For production
# OR for local:
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DATABASE=las_analyzer
```

### 3. Frontend Configuration
Navigate to the `frontend` directory and install dependencies:
```bash
cd ../frontend
npm install
```

---

## 🗄️ Database Schema

The application uses three primary tables:

1. **`wells`**: Stores well metadata (Name, Start/Stop Depth, Step, S3 URL).
2. **`curves`**: Lists available logs for each well (Name, Unit).
3. **`well_logs`**: Stores the actual time-series/depth-series data as JSONB for flexible querying.

```sql
-- Example Schema Overview
CREATE TABLE wells (
    id UUID PRIMARY KEY,
    name TEXT,
    start_depth FLOAT,
    stop_depth FLOAT,
    step FLOAT,
    file_url TEXT
);

CREATE TABLE curves (
    id SERIAL PRIMARY KEY,
    well_id UUID REFERENCES wells(id),
    name TEXT,
    unit TEXT
);

CREATE TABLE well_logs (
    id SERIAL PRIMARY KEY,
    well_id UUID REFERENCES wells(id),
    depth FLOAT,
    log_values JSONB
);
```

---

## 🏃 Running the App

### Start Backend
```bash
cd backend
npm run dev
```
*Server runs on `http://localhost:5050`*

### Start Frontend
```bash
cd frontend
npm run dev
```
*App accessible at `http://localhost:5173`*

---

## 🔌 API Endpoints (Highlights)

- `POST /api/upload-las`: Uploads file to S3, parses data, and seeds the database.
- `GET /api/wells`: Retrieves all processed wells.
- `GET /api/wells/:id/curves`: Gets available curves for a specific well.
- `GET /api/wells/:id/data`: Fetches depth-indexed log values with range filters.
- `POST /api/wells/:id/interpret`: Runs statistical analysis and outlier removal.
- `POST /api/wells/:id/chat`: Natural language query interface for well logs.

---

## 🤝 Contributing
Feel free to fork this project and submit pull requests. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License
[ISC](https://choosealicense.com/licenses/isc/)
