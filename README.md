# Student Feedback

A college feedback portal. Students submit course and campus ratings, and the academic office retrieves the stored responses.

Without cloud credentials, responses are saved in `data/feedback.json`. Set `MONGODB_URI` to a [MongoDB Atlas](https://www.mongodb.com/atlas) connection string and the same application stores and queries feedback in the cloud. The pages and API do not change.

## Run locally

```powershell
cd "C:\Users\Femy Antony\OneDrive\Desktop\cloud project"
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

1. Submit a response on the home page.
2. Open **Responses**. The page calls `GET /api/feedback` and `GET /api/stats` and shows the records just saved.
3. Open [http://localhost:3000/api/feedback](http://localhost:3000/api/feedback) to see the raw JSON retrieval.

Copy `.env.example` to `.env` to change the port or the office key. The demo delete key is `admin123`.

## Cloud database

1. Create a free MongoDB Atlas cluster and a database user.
2. Allow your host (or `0.0.0.0/0` for a class demo) in Network Access.
3. Put the connection string in `.env`:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=student_feedback
```

4. Restart the app. The storage badge switches to **MongoDB Atlas**.
5. Submit feedback, then retrieve it on the Responses page. In Atlas, the documents are in the `student_feedback.feedback` collection.

Search, department, and minimum rating are applied in the database query, not only in the browser.

## Deploy the app

The service is a Node web app. `render.yaml` is ready for [Render](https://render.com):

1. Push this folder to a Git host.
2. Create a Render web service from the repo. It reads `render.yaml`.
3. Set `MONGODB_URI` in the Render environment.
4. Open the Render URL, submit feedback, and retrieve it. Atlas holds the data after the web service restarts.

Docker:

```powershell
docker build -t student-feedback .
docker run --rm -p 3000:3000 -e MONGODB_URI -e ADMIN_KEY student-feedback
```

Pass the Atlas URI with `-e MONGODB_URI="mongodb+srv://..."`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Storage mode |
| `GET` | `/api/meta` | Departments, years, rating labels |
| `POST` | `/api/feedback` | Store one response |
| `GET` | `/api/feedback` | Retrieve responses (`q`, `department`, `minRating`) |
| `GET` | `/api/feedback/:id` | Retrieve one response |
| `GET` | `/api/stats` | Counts and averages |
| `DELETE` | `/api/feedback/:id` | Remove a response. Header: `x-admin-key` |
