const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const cors = require("cors");
const path = require("path");

const app = express();
const port = 8001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Directory to store uploaded chunks and final files
const UPLOAD_DIR = path.join(__dirname, "uploads");
const FINAL_DIR = path.join(UPLOAD_DIR, "final");

// Ensure directories exist
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(FINAL_DIR);

// Multer configuration for chunk uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Route to handle chunk uploads
app.post("/upload", upload.single("chunk"), async (req, res) => {
  const { fileName, chunkNumber, totalChunks } = req.body;

  if (!req.file || !fileName || !chunkNumber || !totalChunks) {
    return res.status(400).send("Missing required parameters");
  }

  const chunkDir = path.join(UPLOAD_DIR, fileName);
  const chunkPath = path.join(chunkDir, `chunk_${chunkNumber}`);

  try {
    // Ensure the directory for chunks exists
    fs.ensureDirSync(chunkDir);

    // Save the chunk to disk
    fs.writeFileSync(chunkPath, req.file.buffer);

    // Check if all chunks are uploaded
    const uploadedChunks = fs.readdirSync(chunkDir);
    if (uploadedChunks.length === parseInt(totalChunks, 10)) {
      const finalPath = path.join(FINAL_DIR, fileName);

      // Combine all chunks to form the final file
      const writeStream = fs.createWriteStream(finalPath);
      for (let i = 0; i < totalChunks; i++) {
        const chunkData = fs.readFileSync(path.join(chunkDir, `chunk_${i}`));
        writeStream.write(chunkData);
      }
      writeStream.end();

      // Remove chunks after combining
      fs.removeSync(chunkDir);
    }

    res.status(200).send("Chunk uploaded successfully");
  } catch (error) {
    console.error("Error handling chunk upload:", error);
    res.status(500).send("Error handling chunk upload");
  }
});

// Route to handle file download
app.get("/download", async (req, res) => {
  const { fileName } = req.query;

  if (!fileName) {
    return res.status(400).send("Missing fileName parameter");
  }

  const filePath = path.join(FINAL_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found");
  }

  const stats = fs.statSync(filePath);
  const range = req.headers.range;

  try {
    if (range) {
      // Parse the Range header
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10) || 0;
      const end = Math.min(parseInt(endStr, 10) || stats.size - 1, stats.size - 1);

      if (start >= stats.size || end >= stats.size || start > end) {
        return res.status(416).send("Requested range not satisfiable");
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "application/octet-stream",
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        res.status(500).send("Error streaming file");
      });
    } else {
      // Serve the entire file if no Range header is provided
      res.writeHead(200, {
        "Content-Length": stats.size,
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      });

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        res.status(500).send("Error streaming file");
      });
    }
  } catch (error) {
    console.error("Error handling file download:", error);
    res.status(500).send("Error during file download");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
